const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(responses = [], env = { RAPIDAPI_KEY: 'test-key' }) {
  const calls = [];
  const context = { exports: {}, URL, AbortSignal, process: { env }, fetch: async (url, options) => {
    calls.push({ url, options });
    return responses.shift() || new Response('{}', { status: 503 });
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/instagram.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { ...context.exports, calls };
}
test('selects video media instead of the original reel URL or image', () => {
  const { extractInstagramVideo } = setup();
  assert.equal(extractInstagramVideo({ url: 'https://www.instagram.com/reel/abc/', medias: [
    { url: 'https://cdn.example/cover.jpg', type: 'image' },
    { url: 'https://cdn.example/small.mp4', type: 'video', height: 480 },
    { url: 'https://cdn.example/large.mp4', type: 'video', height: 1080 },
  ] }), 'https://cdn.example/large.mp4');
  assert.equal(extractInstagramVideo({ url: 'https://www.instagram.com/reel/abc/', thumbnail: 'https://cdn.example/cover.jpg' }), '');
});
test('calls the selected fetch endpoint and reads its download_url', async () => {
  const { getInstagramMetadata, calls } = setup([
    new Response(JSON.stringify({ title: 'Reel', author: 'Creator', type: 'video', download_url: 'https://cdn.example/video.mp4' })),
  ]);
  const result = await getInstagramMetadata('https://www.instagram.com/reel/abc/?igsh=tracking');
  assert.equal(result.directUrls.video, 'https://cdn.example/video.mp4');
  assert.equal(result.platform, 'instagram');
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, '/fetch');
  assert.equal(new URL(calls[0].url).hostname, 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com');
  assert.equal(new URL(calls[0].url).searchParams.get('url'), 'https://www.instagram.com/reel/abc/');
});
test('rejects absent credentials and lookalike hosts before network requests', async () => {
  const { getInstagramMetadata, calls } = setup([], {});
  await assert.rejects(getInstagramMetadata('https://www.instagram.com/reel/abc/'), /not configured/);
  await assert.rejects(getInstagramMetadata('https://instagram.com.attacker.example/reel/abc/'), /valid Instagram/);
  assert.equal(calls.length, 0);
});
test('reports unavailable reels instead of returning empty download links', async () => {
  const { getInstagramMetadata } = setup([new Response('{}'), new Response('{}')]);
  await assert.rejects(getInstagramMetadata('https://www.instagram.com/reel/abc/'), /could not be retrieved/);
});
