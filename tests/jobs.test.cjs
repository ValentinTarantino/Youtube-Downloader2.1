const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function setup() {
  let calls = 0;
  const context = { exports: {}, require, URL, Buffer, AbortSignal,
    process: { env: { VIDFETCH_API_KEY: 'test-secret' } },
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ id: 'dl_test', status: 'queued' }));
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/jobs/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { routes: context.exports, calls: () => calls };
}
function request(body, origin = 'https://app.example') {
  return { nextUrl: new URL('https://app.example/api/jobs'), headers: new Headers({ origin }), json: async () => body };
}
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
test('rejects cross-origin requests and non-YouTube sources before billing', async () => {
  const { routes, calls } = setup();
  assert.equal((await routes.POST(request({}, 'https://other.example'))).status, 403);
  assert.equal((await routes.POST(request({ url: 'http://127.0.0.1', format: '720p' }))).status, 400);
  assert.equal(calls(), 0);
});
