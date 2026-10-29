import { Innertube, Platform, ClientType } from 'youtubei.js';
import { runInNewContext } from 'node:vm';
Platform.shim.eval = async (data, env = {}) => runInNewContext(`(function(){${data.output}\n})()`, { ...env }, { timeout: 5000 });
const videoId = process.argv[2] || 'oR3xm3CyGCI';
for (const client of [ClientType.WEB_EMBEDDED, ClientType.TV, ClientType.TV_EMBEDDED]) {
  try {
    const yt = await Innertube.create({ client_type: client, generate_session_locally: true });
    const info = await yt.getBasicInfo(videoId);
    console.log(client, info.playability_status?.status);
    const hls = info.streaming_data?.hls_manifest_url;
    if (hls) {
      const response = await fetch(hls);
      const manifest = await response.text();
      console.log(client, 'HLS', response.status, manifest.split('\n').filter(line => line.includes('RESOLUTION')).join('\n'));
    }
    const formats = [...(info.streaming_data?.formats || []), ...(info.streaming_data?.adaptive_formats || [])];
    for (const f of formats.filter(f => f.height === 720 || (f.has_audio && !f.has_video)).slice(0, 4)) {
      try {
        const url = await f.decipher(yt.session.player);
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        console.log(JSON.stringify({ client, itag: f.itag, height: f.height, status: response.status }));
        await response.body?.cancel();
      } catch (e) { console.log(client, f.itag, 'format error:', e.message); }
    }
  } catch (e) { console.log(client, 'extraction error:', e.message, e.cause?.code || ''); }
}
