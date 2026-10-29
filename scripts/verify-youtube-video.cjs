const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/youtube-video.ts'), 'utf8');
const context = { exports: {}, require, process, console };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
(async () => {
  for (const height of [720, 480, 360]) {
    const result = await context.exports.downloadYouTubeVideo('oR3xm3CyGCI', height, require('ffmpeg-static'));
    const body = Buffer.from(await new Response(result.body).arrayBuffer());
    assert.equal(body.length, result.size);
    assert.ok(body.length > 0);
    const output = path.join(__dirname, `../.tools/verified-${height}.mp4`);
    fs.writeFileSync(output, body);
    console.log(JSON.stringify({ height: result.height, bytes: body.length, file: output }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
