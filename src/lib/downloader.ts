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

// YouTube Metadata Logic
async function getYouTubeMetadata(url: string): Promise<VideoMetadata> {
  const METADATA_HOST = 'social-media-video-downloader.p.rapidapi.com';
  const videoId = url.match(/(?:youtu\.be\/|(?:www\.)?youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=))([^&]{11})/)?.[1];

  try {
    const res = await fetch(
      `https://${METADATA_HOST}/youtube/v3/video/details?url=${encodeURIComponent(url)}&urlAccess=normal`,
      { headers: RAPID_HEADERS(METADATA_HOST) }
    );

    if (!res.ok) throw new Error(`Metadata error: ${res.status}`);
    const data = await res.json();
    const content = data.contents?.[0];

    if (!content) throw new Error("No metadata found");

    return {
      title: content.title || "YouTube Video",
      thumbnail: content.thumbnails?.[content.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      author: content.author?.name || "Creator",
      authorAvatar: content.author?.thumbnails?.[0]?.url || "",
      platform: 'youtube'
    };
  } catch (error) {
    // Fallback simple
    return {
      title: "YouTube Video",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      author: "YouTube Creator",
      platform: 'youtube'
    };
  }
}

// TikTok Metadata Logic
async function getTikTokMetadata(url: string): Promise<VideoMetadata> {
  const TIKTOK_HOST = process.env.TIKTOK_API_HOST || 'tiktok-video-downloader-api1.p.rapidapi.com';
  
  try {
    const res = await fetch(
      `https://${TIKTOK_HOST}/media?videoUrl=${encodeURIComponent(url)}`,
      { headers: RAPID_HEADERS(TIKTOK_HOST) }
    );

    if (!res.ok) throw new Error("TikTok API error");
    const data = await res.json();
    
    // Basado en la respuesta típica de elisbushaj2/tiktok-video-downloader-api
    return {
      title: data.title || "TikTok Video",
      thumbnail: data.cover || "",
      author: data.author || "TikTok Creator",
      platform: 'tiktok',
      directUrls: {
        video: data.play || "", // Sin marca de agua
        audio: data.music || ""
      }
    };
  } catch (error) {
    throw new Error("Could not retrieve TikTok information.");
  }
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  if (url.includes("tiktok.com")) {
    return getTikTokMetadata(url);
  }
  return getYouTubeMetadata(url);
}

// Download logic for YouTube (Polling)
export async function requestDownload(options: DownloadOptions): Promise<{ jobId: string }> {
  const format = options.isAudioOnly ? "mp3" : (options.quality || "720");
  const res = await fetch(
    `https://${process.env.RAPIDAPI_HOST}/ajax/download.php?format=${format}&url=${encodeURIComponent(options.url)}&audio_quality=128&add_info=0&no_merge=false`,
    { headers: RAPID_HEADERS(process.env.RAPIDAPI_HOST || '') }
  );

  if (!res.ok) throw new Error("Download engine error.");
  const data = await res.json();
  if (!data.id) throw new Error("No download ID.");
  return { jobId: data.id };
}

export async function checkDownloadProgress(jobId: string): Promise<{ progress: number, downloadUrl?: string, status: string }> {
  const res = await fetch(`https://p.savenow.to/api/progress?id=${jobId}`);
  if (!res.ok) throw new Error("Progress check error.");
  const data = await res.json();
  return {
    progress: data.progress,
    downloadUrl: data.download_url,
    status: data.text || "Downloading"
  };
}

export interface DownloadOptions {
  url: string;
  isAudioOnly?: boolean;
  quality?: "360" | "480" | "720" | "1080" | "max";
}
