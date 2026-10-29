import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const base = process.env.DOWNLOAD_BACKEND_URL;
const token = process.env.DOWNLOAD_BACKEND_TOKEN;
if (!base || !token) throw new Error('Set DOWNLOAD_BACKEND_URL and DOWNLOAD_BACKEND_TOKEN');
const health = await fetch(new URL('/api/health', base));
if (!health.ok) throw new Error(`Health check: HTTP ${health.status}`);
const unauthorized = await fetch(new URL('/api/download', base));
if (unauthorized.status !== 401) throw new Error('Backend must reject unauthenticated downloads');
await mkdir('.tools', { recursive: true });
for (const [type, quality] of [['video', '720'], ['video', '480'], ['video', '360'], ['audio', '720']]) {
  const endpoint = new URL('/api/download', base);
  endpoint.search = new URLSearchParams({ url: 'https://www.youtube.com/watch?v=oR3xm3CyGCI', type, quality }).toString();
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error(`${type}/${quality}: HTTP ${response.status}: ${await response.text()}`);
  if (type === 'video' && response.headers.get('x-video-height') !== quality) throw new Error('Resolution mismatch');
  const file = `.tools/server-${type}-${quality}.${type === 'video' ? 'mp4' : 'mp3'}`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  const { size } = await stat(file);
  if (!size) throw new Error('Empty download');
  console.log(JSON.stringify({ type, quality, size, file }));
}
