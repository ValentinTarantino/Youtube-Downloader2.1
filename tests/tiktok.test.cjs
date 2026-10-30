const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(data, status = 200) {
  const calls = [];
  const context = { exports: {}, URL, AbortSignal, fetch: async (url) => {
    calls.push(url.href);
    return new Response(JSON.stringify(data), { status });
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tiktok.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { get: context.exports.getTikTokMetadata, calls };
}
test('short links request HD and prefer the watermark-free HD stream', async () => {
  const { get, calls } = setup({ code: 0, data: { hdplay: 'https://cdn.example/hd.mp4', play: 'https://cdn.example/sd.mp4', wmplay: 'https://cdn.example/wm.mp4', author: { nickname: 'Creator' } } });
  const result = await get('https://vm.tiktok.com/abc/');
  assert.equal(result.directUrls.video, 'https://cdn.example/hd.mp4');
  assert.equal(result.author, 'Creator');
  assert.equal(new URL(calls[0]).searchParams.get('hd'), '1');
  assert.equal(new URL(calls[0]).searchParams.get('url'), 'https://vm.tiktok.com/abc/');
});
test('falls back to watermark-free play, never wmplay', async () => {
  const { get } = setup({ code: 0, data: { play: '/video/play.mp4' } });
  assert.equal((await get('https://www.tiktok.com/@a/video/123')).directUrls.video, 'https://www.tikwm.com/video/play.mp4');
  await assert.rejects(setup({ code: 0, data: { wmplay: 'https://cdn.example/wm.mp4' } }).get('https://vm.tiktok.com/abc/'), /watermark-free/);
});
test('rejects photos, provider failures and lookalike input hosts', async () => {
  await assert.rejects(setup({ code: 0, data: { images: ['image'] } }).get('https://vm.tiktok.com/abc/'), /photo post/);
  await assert.rejects(setup({}, 429).get('https://vm.tiktok.com/abc/'), /busy/);
  await assert.rejects(setup({ code: -1 }).get('https://vm.tiktok.com/abc/'), /could not be retrieved/);
  const { get, calls } = setup({});
  await assert.rejects(get('https://tiktok.com.attacker.example/'), /valid HTTPS/);
  assert.equal(calls.length, 0);
});
