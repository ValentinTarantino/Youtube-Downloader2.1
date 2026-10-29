const { loadEnvConfig } = require('@next/env');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');
loadEnvConfig(process.cwd());
const key = process.env.VIDFETCH_API_KEY;
if (!key) throw new Error('VIDFETCH_API_KEY is missing');
async function request(path, body) {
  const res = await fetch(`https://api.vidfetch.dev/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
(async () => {
  fs.mkdirSync('.tools', { recursive: true });
  for (const format of ['720p', 'mp3']) {
    const file = `.tools/vidfetch-${format}.json`;
    let job = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : await request('downloads', {
      url: 'https://www.youtube.com/watch?v=oR3xm3CyGCI', format,
    });
    fs.writeFileSync(file, JSON.stringify(job));
    console.log(JSON.stringify({ format, id: job.id, status: job.status, fields: Object.keys(job) }));
    if (!job.id) throw new Error('Missing job ID');
    for (let attempt = 0; attempt < 60 && !['completed', 'failed', 'deleted'].includes(job.status); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      job = await request(`downloads/${encodeURIComponent(job.id)}`);
      fs.writeFileSync(file, JSON.stringify(job));
      console.log(JSON.stringify({ format, status: job.status, progress: job.progress, error: job.error }));
    }
    if (job.status !== 'completed') throw new Error(`Job ${job.status}: ${JSON.stringify(job.error || job.error_message || '')}`);
    if (!job.download_url || new URL(job.download_url).protocol !== 'https:') throw new Error('Missing HTTPS download link');
    const response = await fetch(job.download_url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`File download HTTP ${response.status}`);
    const output = `.tools/vidfetch-${format}.${format === 'mp3' ? 'mp3' : 'mp4'}`;
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(output));
    const args = ['-v', 'info', '-i', output, '-map', '0:a:0'];
    if (format !== 'mp3') args.push('-map', '0:v:0', '-frames:v', '1');
    args.push('-t', '1', '-f', 'null', '-');
    const check = spawnSync(require('ffmpeg-static'), args, { encoding: 'utf8' });
    if (check.status !== 0) throw new Error('Downloaded media failed FFmpeg validation');
    if (format === '720p' && !/Video:[^\r\n]*\b\d+x720\b/.test(check.stderr)) throw new Error('Output is not 720p');
    console.log(JSON.stringify({ format, verified: true, bytes: fs.statSync(output).size }));
  }
})().catch(error => { console.error(error.message, error.cause?.code || ''); process.exitCode = 1; });
