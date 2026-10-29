const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const binary = require('ffmpeg-static');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/mux-video.ts'), 'utf8');
const context = { exports: {}, require, console };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { muxVideo } = context.exports;

function fixture(args) {
  const result = spawnSync(binary, ['-v', 'error', '-f', 'lavfi', ...args, '-t', '0.2', '-f', 'matroska', 'pipe:1']);
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}
const video = fixture(['-i', 'color=size=1280x720:rate=5', '-c:v', 'libx264']);
const audio = fixture(['-i', 'sine=frequency=440', '-c:a', 'aac']);
const transport = async (url) => new Response(url === 'video' ? video : audio);

test('produces a nonempty verified 720p MP4 with audio', async () => {
  const stream = await muxVideo('video', 'audio', 720, binary, transport);
  const bytes = Buffer.from(await new Response(stream).arrayBuffer());
  assert.ok(bytes.length > 100);
  assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
});
test('rejects CDN failure before returning a download stream', async () => {
  await assert.rejects(muxVideo('video', 'audio', 720, binary,
    async () => new Response('Forbidden', { status: 403 })), /HTTP 403/);
});
test('rejects wrong resolution rather than delivering it', async () => {
  await assert.rejects(muxVideo('video', 'audio', 480, binary, transport), /resolution/);
});
test('rejects empty upstream media', async () => {
  await assert.rejects(muxVideo('video', 'audio', 720, binary,
    async () => new Response(new Uint8Array())), /empty file/);
});
