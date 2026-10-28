import { createColdStartToken } from "bgutils-js/webpo";
import { Innertube, Platform, ClientType } from "youtubei.js";

// Evaluator
Platform.shim.eval = async (data, env = {}) => {
  const keys = Object.keys(env);
  const vals = Object.values(env);
  return new Function(...keys, data.output)(...vals);
};

async function testDownload() {
  const videoId = "oVAp5UDnsPI";
  const pot = createColdStartToken(videoId);

  const yt = await Innertube.create({
    client_type: ClientType.ANDROID,
    po_token: pot,
    generate_session_locally: true,
  });

  const info = await yt.getBasicInfo(videoId, { po_token: pot });
  const prog18 = info.streaming_data?.formats?.find(f => f.itag === 18);
  console.log("Prog 18:", prog18?.url ? "HAS DIRECT URL" : "NO DIRECT URL");

  const url = prog18.url || (await prog18.decipher(yt.session.player));
  const res = await fetch(url);
  console.log("Fetch Prog 18:", res.status, "Length:", res.headers.get("content-length"));
}

testDownload();
