"use server";

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  author: string;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
  return match ? match[1] : null;
}

const RAPID_HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
  'x-rapidapi-host': process.env.RAPIDAPI_HOST || ''
};

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL de YouTube inválida.");

  try {
    // Usamos noembed (un servicio gratuito y muy estable para metadatos)
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error();
    
    const data = await res.json();
    
    return {
      title: data.title || "Video",
      thumbnail: data.thumbnail_url || "",
      author: data.author_name || "YouTube",
    };
  } catch (error) {
    // Segundo fallback por si acaso
    return {
      title: "Video de YouTube",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      author: "YouTube User",
    };
  }
}

export interface DownloadOptions {
  url: string;
  isAudioOnly?: boolean;
  quality?: "360" | "480" | "720" | "1080" | "max";
  title?: string;
}

// Paso 1: Iniciar la descarga
export async function requestDownload(options: DownloadOptions): Promise<{ jobId: string }> {
  const format = options.isAudioOnly ? "mp3" : (options.quality || "720");
  
  // Endpoint de Youtube Master
  const res = await fetch(
    `https://${process.env.RAPIDAPI_HOST}/ajax/download.php?format=${format}&url=${encodeURIComponent(options.url)}&audio_quality=128&add_info=0&no_merge=false`,
    { headers: RAPID_HEADERS }
  );

  if (!res.ok) throw new Error("El motor no aceptó la petición de descarga.");
  
  const data = await res.json();
  
  if (!data.id) throw new Error("No se pudo obtener el ID de descarga.");
  
  return { jobId: data.id };
}

// Paso 2: Consultar progreso (esta API usa un dominio externo para el progreso)
export async function checkDownloadProgress(jobId: string): Promise<{ progress: number, downloadUrl?: string, status: string }> {
  // El progreso en esta API se consulta en p.savenow.to
  const res = await fetch(`https://p.savenow.to/api/progress?id=${jobId}`);

  if (!res.ok) throw new Error("Error al consultar progreso.");
  
  const data = await res.json();
  
  return {
    progress: data.progress, // de 0 a 1000 (1000 = listo)
    downloadUrl: data.download_url,
    status: data.text || "Downloading"
  };
}

export async function getDownloadUrl(options: DownloadOptions): Promise<string> {
  // Función puente para mantener compatibilidad si se llama
  const { jobId } = await requestDownload(options);
  return jobId; 
}
