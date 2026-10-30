import type { VideoMetadata } from "./downloader";

function httpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

// Only explicitly identified video fields are downloadable. A root `url` often
// points to the Instagram page, and thumbnail URLs must never become MP4 files.
export function extractInstagramVideo(payload: unknown): string {
  const candidates: { url: string; height: number }[] = [];
  const walk = (node: any, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 12) return;
    if (Array.isArray(node)) { node.forEach(item => walk(item, depth + 1)); return; }
    const add = (value: unknown) => {
      const url = httpsUrl(value);
      if (!url) return;
      const parsed = new URL(url);
      if (parsed.hostname === "instagram.com" || parsed.hostname.endsWith(".instagram.com")) return;
      if (/\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(url)) return;
      candidates.push({ url, height: Number(node.height) || 0 });
    };
    for (const key of ["video_url", "download_url", "mp4"]) add(node[key]);
    if (typeof node.video === "string") add(node.video);
    const videoType = node.type === "video" || node.extension === "mp4" || node.ext === "mp4"
      || String(node.mime_type || node.mimeType || "").startsWith("video/");
    if (videoType || (typeof node.url === "string" && /\.mp4(?:$|\?)/i.test(node.url))) add(node.url);
    for (const value of Object.values(node)) walk(value, depth + 1);
  };
  walk(payload);
  return candidates.sort((a, b) => b.height - a.height)[0]?.url || "";
}

export async function getInstagramMetadata(raw: string): Promise<VideoMetadata> {
  const url = new URL(raw);
  const match = url.pathname.match(/^\/(?:reel|reels|p)\/([\w-]+)\/?$/);
  if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com", "m.instagram.com"].includes(url.hostname) || !match) {
    throw new Error("Please enter a valid Instagram reel or video post link.");
  }
  const key = process.env.INSTAGRAM_API_KEY?.trim() || process.env.RAPIDAPI_KEY?.trim();
  if (!key) throw new Error("Instagram configuration is missing: set INSTAGRAM_API_KEY or RAPIDAPI_KEY in the deployment environment, then redeploy.");
  const cleanUrl = `https://www.instagram.com/${url.pathname.startsWith("/p/") ? "p" : "reel"}/${match[1]}/`;
  const hosts = [...new Set([
    process.env.INSTAGRAM_API_HOST || "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com",
  ])];
  let failure = "This reel could not be retrieved. Make sure it is public and try again.";
  for (const host of hosts) {
    if (!/^[a-z0-9-]+(?:\.p)?\.rapidapi\.com$/.test(host)) continue;
    try {
      const res = await fetch(`https://${host}/fetch?url=${encodeURIComponent(cleanUrl)}`, {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
        signal: AbortSignal.timeout(12000), cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) failure = "Instagram provider access is unavailable. Check the API key and subscription.";
        if (res.status === 429) failure = "Instagram downloads are busy. Please try again later.";
        continue;
      }
      const payload = await res.json();
      if (payload.error || payload.status === "error") continue;
      const video = extractInstagramVideo(payload);
      if (!video) continue;
      const data = payload.data && !Array.isArray(payload.data) ? payload.data : payload;
      const author = typeof data.author === "string" ? data.author
        : data.author?.username || data.owner?.username || data.username;
      return {
        platform: "instagram",
        title: String(data.title || data.caption?.text || data.caption || `Instagram Reel ${match[1]}`).slice(0, 180),
        thumbnail: httpsUrl(data.thumbnail) || httpsUrl(data.thumbnail_url) || httpsUrl(data.cover),
        author: typeof author === "string" ? author : "Instagram Creator",
        authorAvatar: httpsUrl(data.author?.avatar) || httpsUrl(data.profile_pic_url),
        directUrls: { video, audio: "" },
      };
    } catch { /* Try the next configured provider without exposing credentials. */ }
  }
  throw new Error(failure);
}
