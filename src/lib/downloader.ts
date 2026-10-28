"use server";

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

const RAPID_HEADERS = (host: string) => ({
  'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
  'x-rapidapi-host': host
});

// =============================================================
// YOUTUBE — High-compatibility metadata extractor
// =============================================================
async function getYouTubeMetadata(url: string): Promise<VideoMetadata> {
  const videoId =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^&?/\s]{11})/)?.[1] ||
    url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) throw new Error("Invalid YouTube link");
  const officialUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(officialUrl)}&format=json`);
    const data = res.ok ? await res.json() : {};
    return {
      title: data.title || "YouTube Video",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author: String(data.author_name || "YouTube Creator"),
      authorAvatar: `https://unavatar.io/youtube/${encodeURIComponent(data.author_name || "")}`,
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
// TIKTOK — IMMUTABLE.
// =============================================================
async function resolveTikTokUrl(url: string): Promise<string> {
  if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      return res.url.split('?')[0];
    } catch { return url; }
  }
  return url;
}

async function getTikTokMetadata(url: string): Promise<VideoMetadata> {
  const TIKTOK_HOST = process.env.TIKTOK_API_HOST || 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com';
  const expandedUrl = await resolveTikTokUrl(url);
  const res = await fetch(`https://${TIKTOK_HOST}/vid/index?url=${encodeURIComponent(expandedUrl)}`, { headers: RAPID_HEADERS(TIKTOK_HOST) });
  const data = await res.json();
  const first = (val: any) => Array.isArray(val) ? val[0] : val;
  const authorName = first(data.author) || first(data.nickname) || "TikTok Creator";
  return {
    title: String(first(data.description) || "TikTok Video"),
    thumbnail: String(first(data.cover) || ""),
    author: String(authorName),
    authorAvatar: `https://unavatar.io/tiktok/${authorName}`,
    platform: 'tiktok',
    directUrls: { video: first(data.video) || "", audio: first(data.music) || "" }
  };
}

// =============================================================
// INSTAGRAM — ISOLATED MODULE (Dual-API fallback for reliability)
// =============================================================
async function getInstagramMetadata(url: string): Promise<VideoMetadata> {
  const cleanUrl = url.split('?')[0];
  const videoId = cleanUrl.match(/(?:\/reels?\/)([a-zA-Z0-9_-]+)/)?.[1] ||
                  cleanUrl.match(/\/p\/([a-zA-Z0-9_-]+)/)?.[1] || 'reel';

  // PRIMARY: Instagram Reels Downloader by EaseApi (RapidAPI ⭐9.8)
  // Host confirmed from RapidAPI playground curl snippet
  const PRIMARY_HOST = 'instagram-reels-downloader-api-p.rapidapi.com';
  // FALLBACK: instagram-pro-downloader (original, used if primary fails)
  const FALLBACK_HOST = process.env.INSTAGRAM_API_HOST || 'instagram-pro-downloader.p.rapidapi.com';

  const deepSearch = (obj: any, keys: string[]): any => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) if (obj[key]) return obj[key];
    for (const k in obj) {
      const found = deepSearch(obj[k], keys);
      if (found) return found;
    }
    return null;
  };

  const tryApi = async (host: string, endpoint: string): Promise<any | null> => {
    try {
      const res = await fetch(endpoint, {
        headers: RAPID_HEADERS(host),
        // Reducimos a 5s para que si falla, la segunda tenga tiempo de responder en Vercel
        signal: AbortSignal.timeout(5000) 
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (text.trim().startsWith('<')) return null;
      const data = JSON.parse(text);
      
      // Verificamos que al menos traiga un link de video para considerarla "exitosa"
      const hasLink = deepSearch(data, ['download_url', 'video_url', 'video', 'url', 'mp4']);
      if (!hasLink || data?.status === 'error') return null;
      
      return data;
    } catch { return null; }
  };

  // Primary API call
  let data = await tryApi(
    PRIMARY_HOST,
    `https://${PRIMARY_HOST}/download?url=${encodeURIComponent(cleanUrl)}`
  );

  // Fallback API call if primary fails or has no link
  if (!data) {
    console.log('[INSTAGRAM] Primary API failed or timed out, trying fallback...');
    data = await tryApi(
      FALLBACK_HOST,
      `https://${FALLBACK_HOST}/download?url=${encodeURIComponent(cleanUrl)}`
    );
  }

  // Log for debugging
  if (data) console.log('[INSTAGRAM RESPONSE]', JSON.stringify(data).substring(0, 300));

  const extractString = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'object') {
      for (const k of ['username', 'name', 'full_name', 'nickname', 'text', 'value']) {
        if (typeof val[k] === 'string' && val[k].trim()) return val[k].trim();
      }
    }
    return null;
  };

  const video      = data ? deepSearch(data, ['download_url', 'video_url', 'video', 'url', 'mp4']) : null;
  const thumb      = data ? deepSearch(data, ['thumbnail', 'thumb', 'cover', 'image', 'display_url', 'thumbnail_url', 'poster']) : null;
  const authorRaw  = data ? deepSearch(data, ['username', 'owner_username', 'author', 'owner', 'user']) : null;
  const avatarRaw  = data ? deepSearch(data, ['profile_pic_url', 'profile_picture', 'avatar', 'profile_image']) : null;
  const titleRaw   = data ? deepSearch(data, ['caption', 'title', 'description', 'text']) : null;

  const authorStr  = extractString(authorRaw) || 'Instagram Creator';
  const avatarStr  = extractString(avatarRaw) || '';
  const thumbStr   = extractString(thumb) || '';
  const titleStr   = extractString(titleRaw) || `Instagram Reel ${videoId}`;
  const videoStr   = extractString(video) || '';

  return {
    title: titleStr.substring(0, 80),
    thumbnail: thumbStr
      ? `https://images.weserv.nl/?url=${encodeURIComponent(thumbStr)}&output=webp&n=-1`
      : '',
    author: authorStr,
    authorAvatar: avatarStr
      ? `https://images.weserv.nl/?url=${encodeURIComponent(avatarStr)}&output=webp&w=100&h=100&fit=cover&mask=circle`
      : `https://unavatar.io/instagram/${encodeURIComponent(authorStr)}`,
    platform: 'instagram',
    directUrls: videoStr ? { video: videoStr, audio: '' } : undefined
  };
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
  quality?: "360" | "480" | "720";
}
