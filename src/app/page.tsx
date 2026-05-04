"use client";

import { useState } from "react";
import Background from "../components/Background";
import SearchBar from "../components/SearchBar";
import VideoInfo from "../components/VideoInfo";
import DownloadOptions from "../components/DownloadOptions";
import { getVideoMetadata, VideoMetadata } from "../lib/downloader";
import { Play } from "lucide-react";

export default function Home() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setMetadata(null);
    setCurrentUrl(url);

    try {
      const data = await getVideoMetadata(url);
      setMetadata(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center py-20 px-4 relative overflow-hidden">
      <Background />
      
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-500/20">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight">
            YT Downloader
          </h1>
        </div>
        
        <p className="text-gray-400 text-lg md:text-xl text-center max-w-2xl mb-12">
          Descarga videos y audios de YouTube en alta calidad al instante, sin anuncios ni límites.
        </p>

        <SearchBar onSearch={handleSearch} isLoading={isLoading} />

        {error && (
          <div className="mt-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center w-full max-w-2xl animate-in fade-in">
            {error}
          </div>
        )}

        {metadata && (
          <div className="w-full flex flex-col items-center mt-4">
            <VideoInfo metadata={metadata} />
            <DownloadOptions url={currentUrl} />
          </div>
        )}
      </div>

      <footer className="absolute bottom-8 text-white/30 text-sm">
        Construido con Next.js & Cobalt API
      </footer>
    </main>
  );
}
