import { Innertube, Platform } from "youtubei.js";
import { runInNewContext } from "node:vm";

Platform.shim.eval = async (data, env = {}) =>
  runInNewContext(`(function(){${data.output}\n})()`, { ...env }, { timeout: 5000 });

const clients = ["ANDROID", "IOS", "ANDROID_VR", "MWEB", "TV", "TV_EMBEDDED", "WEB_EMBEDDED", "ANDROID_TESTSUITE", "WEB"];
const id = process.argv[2] || "14XbhBUBgqI";
const height = Number(process.argv[3] || 720);

for (const client of clients) {
  try {
    const yt = await Innertube.create({ client_type: client, generate_session_locally: true });
    const info = await yt.getBasicInfo(id);
    const status = info.playability_status?.status;
    const adaptive = info.streaming_data?.adaptive_formats || [];
    const candidates = adaptive.filter((f) => f.has_video && f.height === height);
    let detail = "no-format";
    if (candidates.length) {
      const f = candidates[0];
      const url = f.url || (await f.decipher(yt.session.player));
      const r = await fetch(url, { headers: { Range: "bytes=0-0" } });
      detail = `formats=${candidates.length} cdn=${r.status}`;
      await r.body?.cancel().catch(() => {});
    }
    console.log(client, status, detail);
  } catch (e) {
    console.log(client, "ERR", String(e?.stack || e).slice(0, 400));
  }
}

