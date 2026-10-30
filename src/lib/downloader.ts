"use server";

import { getTikTokMetadata } from "./tiktok";
import { getInstagramMetadata } from "./instagram";

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  author: string;
  authorAvatar?: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  directUrls?: {
    video: string;
    audio: string;
  };
}

// =============================================================
// YOUTUBE — High-compatibility metadata extractor
// =============================================================
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  cookie: "CONSENT=YES+1",
};

/**
 * Resolves the real channel avatar from the public channel page.
 * oEmbed gives us the channel URL (e.g. https://www.youtube.com/@handle),
 * and the page HTML exposes the avatar as `og:image` / `ytInitialData.avatar`.
 */
async function getChannelAvatar(channelUrl?: string): Promise<string | undefined> {
  if (!channelUrl) return undefined;
  try {
    const res = await fetch(channelUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const fromJson = html.match(/"avatar":\{"thumbnails":\[\{"url":"(https:[^"]+)"/)?.[1];
    const fromOg = html.match(/<meta property="og:image" content="(https:[^"]+)"/)?.[1];
    const raw = fromJson || fromOg;
    if (!raw) return undefined;
    // Normalize to a square 176px avatar if the CDN sizing suffix is present.
    return raw.includes("=s") ? raw.replace(/=s\d+.*$/, "=s176-c-k-c0x00ffffff-no-rj") : raw;
  } catch {
    return undefined;
  }
}

async function getYouTubeMetadata(url: string): Promise<VideoMetadata> {
  const videoId =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^&?/\s]{11})/)?.[1] ||
    url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Invalid YouTube link");
  const officialUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(officialUrl)}&format=json`);
    const data = res.ok ? await res.json() : {};
    const author = String(data.author_name || "YouTube Creator");
    const realAvatar = await getChannelAvatar(
      typeof data.author_url === "string" ? data.author_url : undefined
    );
    return {
      title: data.title || "YouTube Video",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author,
      // Real channel photo when available, otherwise the generic avatar.
      authorAvatar:
        realAvatar || `https://unavatar.io/youtube/${encodeURIComponent(author)}`,
      platform: 'youtube'
    };
  } catch {
    return {
      title: "YouTube Video",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author: "YouTube Creator",
      platform: 'youtube'
    };
  }
}

// =============================================================
// PUBLIC ROUTER
// =============================================================
export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  if (url.includes("tiktok.com")) return getTikTokMetadata(url);
  if (url.includes("instagram.com")) return getInstagramMetadata(url);
  return getYouTubeMetadata(url);
}

export interface DownloadOptions {
  quality?: "360" | "480" | "720" | "1080";
}
