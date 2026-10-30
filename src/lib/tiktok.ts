import type { VideoMetadata } from "./downloader";

function mediaUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, "https://www.tikwm.com");
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

export async function getTikTokMetadata(raw: string): Promise<VideoMetadata> {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname)) {
    throw new Error("Please enter a valid HTTPS TikTok link.");
  }
  // TikWM resolves short links itself; no browser cookies or RapidAPI key required.
  const endpoint = new URL("https://www.tikwm.com/api/");
  endpoint.searchParams.set("url", url.href);
  endpoint.searchParams.set("hd", "1");
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 429
    ? "TikTok downloads are busy. Please try again shortly."
    : "The TikTok provider is unavailable. Please try again.");
  const result = await response.json();
  if (result.code !== 0 || !result.data) throw new Error("This TikTok video could not be retrieved. Check that it is public and try again.");
  const data = result.data;
  // wmplay is deliberately excluded: it is the watermarked rendition.
  const video = mediaUrl(data.hdplay) || mediaUrl(data.play);
  if (!video) throw new Error(Array.isArray(data.images) && data.images.length
    ? "This TikTok is a photo post. Please choose a video."
    : "A watermark-free video is not available for this TikTok.");
  return {
    platform: "tiktok",
    title: typeof data.title === "string" && data.title ? data.title : "TikTok Video",
    thumbnail: mediaUrl(data.cover) || mediaUrl(data.origin_cover),
    author: String(data.author?.nickname || data.author?.unique_id || "TikTok Creator"),
    authorAvatar: mediaUrl(data.author?.avatar),
    directUrls: { video, audio: mediaUrl(data.music) },
  };
}
