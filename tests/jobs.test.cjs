const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function setup(responder, env = {}) {
  let calls = 0;
  const context = { exports: {}, require, URL, Buffer, AbortSignal, Headers,
    process: { env: { VIDFETCH_API_KEY: 'test-secret', ...env } },
    fetch: async (...args) => {
      calls++;
      if (responder) return responder(...args);
      return new Response(JSON.stringify({ id: 'dl_test', status: 'queued' }));
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/jobs/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return { routes: context.exports, calls: () => calls };
}
function request(body, origin = 'https://app.example') {
  return { nextUrl: new URL('https://app.example/api/jobs'), headers: new Headers({ origin }), json: async () => body };
}

test('passes the selected 1080p quality unchanged to the provider', async () => {
  const { routes } = setup(async (url, options) => {
    assert.equal(JSON.parse(options.body).format, '1080p');
    return new Response(JSON.stringify({ id: 'dl_fullhd', status: 'queued' }));
  });
  const response = await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '1080p' }));
  assert.equal(response.status, 202);
});

test('quota fallback binds subsequent status requests to the backup account', async () => {
  const seen = [];
  const { routes } = setup(async (url, options) => {
    seen.push(options.headers.Authorization);
    if (options.headers.Authorization === 'Bearer test-secret') return new Response('{}', { status: 402 });
    return new Response(JSON.stringify({ id: 'dl_backup', status: 'queued' }));
  }, { VIDFETCH_API_KEY_BACKUP: 'backup-secret' });
  const created = await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '720p' }));
  assert.equal(created.status, 202);
  const { ticket } = await created.json();
  assert.equal((await routes.GET({ nextUrl: new URL(`https://app.example/api/jobs?ticket=${ticket}`) })).status, 200);
  assert.deepEqual(seen, ['Bearer test-secret', 'Bearer backup-secret', 'Bearer backup-secret']);
});

test('does not switch accounts for ambiguous failures, auth errors or rate limits', async () => {
  for (const status of [401, 429, 500]) {
    const { routes, calls } = setup(async () => new Response('{}', { status }), { VIDFETCH_API_KEY_BACKUP: 'backup-secret' });
    assert.equal((await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '720p' }))).status, 502);
    assert.equal(calls(), 1);
  }
});

test('stops when both quotas are exhausted', async () => {
  const { routes, calls } = setup(async () => new Response('{}', { status: 402 }), { VIDFETCH_API_KEY_BACKUP: 'backup-secret' });
  assert.equal((await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '720p' }))).status, 502);
  assert.equal(calls(), 2);
});
test('creates signed job access without returning provider credentials', async () => {
  const { routes, calls } = setup();
  const response = await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '720p' }));
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.ok(body.ticket);
  assert.ok(!JSON.stringify(body).includes('test-secret'));
  const status = await routes.GET({ nextUrl: new URL(`https://app.example/api/jobs?ticket=${body.ticket}`) });
  assert.equal(status.status, 200);
  assert.equal(calls(), 2);
  const tampered = await routes.GET({ nextUrl: new URL(`https://app.example/api/jobs?ticket=${body.ticket.replace('dl_test', 'dl_other')}`) });
  assert.equal(tampered.status, 403);
  assert.equal(calls(), 2);
});

test('streams an attachment before the file completes and forwards Range without API credentials', async () => {
  let streamController;
  const source = new ReadableStream({ start(controller) {
    streamController = controller;
    controller.enqueue(new Uint8Array([1, 2]));
  } });
  const { routes } = setup(async (url, options) => {
    if (url.startsWith('https://api.vidfetch.dev/')) {
      return new Response(JSON.stringify({ id: 'dl_test', status: 'completed',
        title: 'Video de prueba', format: '720p', download_url: 'https://storage.example/file' }));
    }
    assert.equal(url, 'https://storage.example/file');
    assert.equal(options.headers.get('Range'), 'bytes=0-3');
    assert.equal(options.headers.get('Authorization'), null);
    return new Response(source, { status: 206, headers: {
      'content-length': '4', 'content-range': 'bytes 0-3/4', 'accept-ranges': 'bytes',
    } });
  });
  const created = await routes.POST(request({ url: 'https://youtu.be/oR3xm3CyGCI', format: '720p' }));
  const { ticket } = await created.json();
  const response = await routes.GET({ nextUrl: new URL(`https://app.example/api/jobs?ticket=${ticket}&download=1`),
    headers: new Headers({ Range: 'bytes=0-3' }) });
  assert.equal(response.status, 206);
  assert.match(response.headers.get('content-disposition'), /^attachment;.*Video de prueba\.mp4/);
  assert.equal(response.headers.get('content-length'), '4');
  assert.equal(response.headers.get('content-range'), 'bytes 0-3/4');
  const reader = response.body.getReader();
  assert.deepEqual(Array.from((await reader.read()).value), [1, 2]);
  streamController.enqueue(new Uint8Array([3, 4]));
  streamController.close();
  assert.deepEqual(Array.from((await reader.read()).value), [3, 4]);
  assert.equal((await reader.read()).done, true);
});
test('rejects cross-origin requests and non-YouTube sources before billing', async () => {
  const { routes, calls } = setup();
  assert.equal((await routes.POST(request({}, 'https://other.example'))).status, 403);
  assert.equal((await routes.POST(request({ url: 'http://127.0.0.1', format: '720p' }))).status, 400);
  assert.equal(calls(), 0);
});
