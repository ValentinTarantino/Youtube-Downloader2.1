const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/format-url.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const context = { exports: {} };
vm.runInNewContext(outputText, context);
const { firstFormatUrl } = context.exports;

test('skips metadata-only audio and reaches progressive audio fallback', async () => {
  const url = await firstFormatUrl([{}, { url: 'https://example.test/audio' }], async (format) => {
    assert.ok(format.url, 'must skip metadata-only formats');
    return format.url;
  });
  assert.equal(url, 'https://example.test/audio');
});

test('transforms direct URLs before validating CDN access', async () => {
  const url = await firstFormatUrl([{ url: 'raw' }], async () => 'transformed', async (candidate) => {
    assert.equal(candidate, 'transformed');
    return true;
  });
  assert.equal(url, 'transformed');
});

test('tries another format when CDN rejects a deciphered URL', async () => {
  const url = await firstFormatUrl([{ url: 'blocked' }, { url: 'working' }],
    async (format) => format.url, async (candidate) => candidate !== 'blocked');
  assert.equal(url, 'working');
});

test('tries the next signed format after a decipher failure', async () => {
  const url = await firstFormatUrl([{ cipher: 'broken' }, { signature_cipher: 'valid' }], async (f) => {
    if (f.cipher) throw new Error('invalid signature');
    return 'https://example.test/video';
  });
  assert.equal(url, 'https://example.test/video');
});

test('reports no URL when all formats are unusable', async () => {
  assert.equal(await firstFormatUrl([{}, { cipher: 'broken' }], async () => {
    throw new Error('invalid signature');
  }), undefined);
});
