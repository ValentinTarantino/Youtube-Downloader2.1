import { Innertube, ClientType } from "youtubei.js";

async function checkCors() {
  const videoId = "oVAp5UDnsPI";
  const yt = await Innertube.create({ client_type: ClientType.ANDROID, generate_session_locally: true });
  const info = await yt.getBasicInfo(videoId);
  const prog18 = info.streaming_data?.formats?.find(f => f.itag === 18);
  
  const res = await fetch(prog18.url, {
    method: "GET",
    headers: {
      "Origin": "https://youtube-downloader2-1-ibdv.vercel.app",
    }
  });

  console.log("Status:", res.status);
  console.log("CORS headers:");
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase().includes("access-control") || k.toLowerCase().includes("origin")) {
      console.log(`  ${k}: ${v}`);
    }
  }
}

checkCors();
