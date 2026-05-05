"use server";

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  author: string;
  authorAvatar?: string;
}

function extractVideoId(url: string): string | null {
  // Regex actualizada para soportar: watch?v=, youtu.be/, /live/, /embed/ y www.
  const match = url.match(/(?:youtu\.be\/|(?:www\.)?youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
  return match ? match[1] : null;
}

const RAPID_HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
  'x-rapidapi-host': process.env.RAPIDAPI_HOST || ''
};

const METADATA_HOST = 'social-media-video-downloader.p.rapidapi.com';

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL.");

  try {
    const res = await fetch(
      `https://${METADATA_HOST}/youtube/v3/video/details?url=${encodeURIComponent(url)}&urlAccess=normal`,
      { 
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
          'x-rapidapi-host': METADATA_HOST
        } 
      }
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
    };
  } catch (error) {
    console.error("Metadata fetch failed:", error);
    // Fallback a noembed
    try {
      const fallbackRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const fallbackData = await fallbackRes.json();
      
      return {
        title: fallbackData.title || "YouTube Video",
        thumbnail: fallbackData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        author: fallbackData.author_name || "YouTube Creator",
        authorAvatar: "",
      };
    } catch (e) {
      return {
        title: "YouTube Video",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        author: "YouTube Creator",
        authorAvatar: "",
      };
    }
  }
}

export async function requestDownload(options: DownloadOptions): Promise<{ jobId: string }> {
  const format = options.isAudioOnly ? "mp3" : (options.quality || "720");
  const res = await fetch(
    `https://${process.env.RAPIDAPI_HOST}/ajax/download.php?format=${format}&url=${encodeURIComponent(options.url)}&audio_quality=128&add_info=0&no_merge=false`,
    { headers: RAPID_HEADERS }
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
  title?: string;
}

export async function getDownloadUrl(options: DownloadOptions): Promise<string> {
  const { jobId } = await requestDownload(options);
  return jobId; 
}
