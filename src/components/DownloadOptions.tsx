"use client";

import { Download, Music, Video, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { requestDownload, checkDownloadProgress, DownloadOptions as DLOptions } from "../lib/downloader";

interface DownloadOptionsProps {
  url: string;
}

export default function DownloadOptions({ url }: DownloadOptionsProps) {
  const [isDownloadingMp4, setIsDownloadingMp4] = useState(false);
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [videoQuality, setVideoQuality] = useState<DLOptions["quality"]>("1080");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const handleDownload = async (type: "video" | "audio") => {
    setError(null);
    setProgress(0);
    const setLoader = type === "video" ? setIsDownloadingMp4 : setIsDownloadingMp3;
    setLoader(true);
    
    try {
      // Paso 1: Pedir el trabajo
      const { jobId } = await requestDownload({
        url,
        isAudioOnly: type === "audio",
        quality: type === "video" ? videoQuality : "1080",
      });

      // Paso 2: Polling desde el navegador (hasta 2 minutos)
      let finalLink = "";
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await checkDownloadProgress(jobId);
        
        // Esta API devuelve el progreso de 0 a 1000
        setProgress(Math.floor((status.progress || 0) / 10));

        if (status.downloadUrl) {
          finalLink = status.downloadUrl;
          break;
        }

        if (status.status === "ERROR") {
          throw new Error("El servidor de descarga falló.");
        }
      }

      if (finalLink) {
        const a = document.createElement("a");
        a.href = finalLink;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error("El video está tardando demasiado. Por favor, intenta de nuevo.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoader(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Boton Video con Selector */}
        <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/80 to-purple-700/80 p-[1px] transition-all hover:scale-[1.02]">
          <div className="absolute inset-0 bg-white/20 blur-md group-hover:bg-white/30 transition-colors" />
          <div className="relative h-full w-full bg-black/40 backdrop-blur-xl rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl">
                  <Video className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Video MP4</p>
                  
                  {/* Selector de Calidad Integrado */}
                  <div className="relative mt-1 inline-block">
                    <select
                      value={videoQuality}
                      onChange={(e) => setVideoQuality(e.target.value as any)}
                      disabled={isDownloadingMp4 || isDownloadingMp3}
                      className="appearance-none bg-blue-500/20 text-blue-100 text-xs py-1 pl-2 pr-6 rounded outline-none cursor-pointer border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    >
                      <option value="1080" className="bg-gray-900">1080p (FHD)</option>
                      <option value="720" className="bg-gray-900">720p (HD)</option>
                      <option value="480" className="bg-gray-900">480p (SD)</option>
                      <option value="360" className="bg-gray-900">360p</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-blue-200 absolute right-1.5 top-1.5 pointer-events-none" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload("video")}
                disabled={isDownloadingMp4 || isDownloadingMp3}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-500/20 hover:bg-blue-500/40 text-white transition-colors disabled:opacity-50"
              >
                {isDownloadingMp4 ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-[10px] font-bold text-blue-200">{progress}%</span>
                  </div>
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Boton Audio */}
        <button
          onClick={() => handleDownload("audio")}
          disabled={isDownloadingMp4 || isDownloadingMp3}
          className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/80 to-teal-700/80 p-[1px] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <div className="absolute inset-0 bg-white/20 blur-md group-hover:bg-white/30 transition-colors" />
          <div className="relative h-full w-full bg-black/40 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Music className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Audio MP3</p>
                <p className="text-emerald-200/70 text-xs">Alta Calidad</p>
              </div>
            </div>
            {isDownloadingMp3 ? (
              <div className="flex flex-col items-center gap-1">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
                <span className="text-[10px] font-bold text-emerald-200">{progress}%</span>
              </div>
            ) : (
              <Download className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
            )}
          </div>
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}
    </div>
  );
}
