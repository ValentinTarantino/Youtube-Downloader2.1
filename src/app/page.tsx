"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, ExternalLink } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import VideoInfo from "@/components/VideoInfo";
import DownloadOptions from "@/components/DownloadOptions";
import Background from "@/components/Background";
import VideoSkeleton from "@/components/VideoSkeleton";
import { getVideoMetadata, VideoMetadata } from "@/lib/downloader";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentVideos, setRecentVideos] = useState<VideoMetadata[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("ytpro_history");
    if (saved) {
      try {
        setRecentVideos(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading history");
      }
    }
  }, []);

  const handleSearch = async (url: string) => {
    if (!url.trim()) {
      setMetadata(null);
      setVideoUrl("");
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMetadata(null);
    setVideoUrl(url);

    try {
      const data = await getVideoMetadata(url);
      setMetadata(data);

      setRecentVideos(prev => {
        const filtered = prev.filter(v => v.title !== data.title);
        const updated = [data, ...filtered].slice(0, 4);
        localStorage.setItem("ytpro_history", JSON.stringify(updated));
        return updated;
      });

    } catch (err) {
      setError("Could not retrieve video information. Please check the URL.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setRecentVideos([]);
    localStorage.removeItem("ytpro_history");
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center py-8 px-4 md:py-12 md:px-24 overflow-x-hidden">
      <Background />

      <header className="text-center mb-8 md:mb-12 z-10 w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-8xl font-extrabold mb-4 tracking-tighter glow-text">
            YT <span className="text-purple-500">PRO</span>
          </h1>
          <p className="text-white/50 text-base md:text-xl max-w-2xl mx-auto font-light px-4">
            Download YouTube content in <span className="text-white font-medium">professional quality</span> with a single click.
          </p>
        </motion.div>
      </header>

      <section className="w-full max-w-3xl z-10 space-y-6 md:space-y-8" aria-label="YouTube Downloader Search">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center text-sm backdrop-blur-md"
              role="alert"
            >
              {error}
            </motion.div>
          )}

          {isLoading && (
            <motion.div
              key="loader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <VideoSkeleton />
            </motion.div>
          )}

          {metadata && !isLoading && (
            <article
              key="content"
              className="space-y-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
              >
                <VideoInfo metadata={metadata} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <DownloadOptions url={videoUrl} metadata={metadata} />
              </motion.div>
            </article>
          )}
        </AnimatePresence>

        {recentVideos.length > 0 && !metadata && !isLoading && (
          <aside
            className="pt-8"
            aria-label="Recent Searches"
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-white/40 font-medium uppercase tracking-widest text-[10px] md:text-xs">
                <History className="w-4 h-4" />
                Recent Searches
              </div>
              <button
                onClick={clearHistory}
                className="text-white/20 hover:text-red-400 transition-colors text-[10px] md:text-xs flex items-center gap-1"
                aria-label="Clear history"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {recentVideos.map((video, idx) => (
                <motion.button
                  key={video.title + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSearch(`https://www.youtube.com/watch?v=${video.thumbnail.split('/vi/')[1]?.split('/')[0]}`)}
                  className="glass-card p-3 rounded-2xl flex items-center gap-4 text-left group"
                >
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-16 md:w-20 h-10 md:h-12 object-cover rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-medium text-xs md:text-sm truncate">{video.title}</p>
                    <p className="text-white/30 text-[10px] md:text-xs truncate">{video.author}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/10 group-hover:text-purple-400 transition-colors" />
                </motion.button>
              ))}
            </div>
          </aside>
        )}
      </section>

      <footer className="mt-auto pt-16 pb-8 text-white/20 text-[10px] md:text-xs font-medium tracking-widest uppercase z-10 text-center">
        YT PRO • Premium Experience • Next.js & Youtube Master API
      </footer>
    </main>
  );
}
