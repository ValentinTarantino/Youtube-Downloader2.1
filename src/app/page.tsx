"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import VideoInfo from "@/components/VideoInfo";
import DownloadOptions from "@/components/DownloadOptions";
import Background from "@/components/Background";
import VideoSkeleton from "@/components/VideoSkeleton";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { getVideoMetadata, VideoMetadata } from "@/lib/downloader";

interface HistoryItem extends VideoMetadata {
  originalUrl?: string;
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentVideos, setRecentVideos] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("clipdrop_history");
    if (saved) {
      try {
        setRecentVideos(JSON.parse(saved));
      } catch {
        console.error("Error loading history");
      }
    }
  }, []);

  const handleSearch = async (url: string) => {
    if (!url || !url.trim()) {
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

      const historyItem: HistoryItem = { ...data, originalUrl: url };

      setRecentVideos((prev) => {
        const filtered = prev.filter((v) => v.title !== data.title);
        const updated = [historyItem, ...filtered].slice(0, 4);
        localStorage.setItem("clipdrop_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError((err as Error).message || "Could not fetch information. Please check the link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
    if (item.originalUrl) {
      handleSearch(item.originalUrl);
    } else if (item.platform === "youtube") {
      const videoId = item.thumbnail.split("/vi/")[1]?.split("/")[0];
      if (videoId) {
        handleSearch(`https://www.youtube.com/watch?v=${videoId}`);
      } else {
        setError("This history item is outdated. Please search for it again.");
      }
    }
  };

  const clearHistory = () => {
    setRecentVideos([]);
    localStorage.removeItem("clipdrop_history");
  };

  return (
    <>
      <main id="top" className="min-h-screen relative flex flex-col items-center py-6 px-4 md:py-10 md:px-20 overflow-x-hidden">
      <Background />

      {/* Header Marquee */}
      <header className="text-center mb-6 md:mb-10 z-10 w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1
            className="text-[clamp(3.5rem,13vw,8rem)] font-extrabold mb-0 tracking-tight pixel-logo"
            aria-label="ClipyDropy"
          >
            CLIP<span className="text-cyan-400">Y</span><span className="text-purple-400">DROP</span><span className="text-cyan-400">Y</span>
          </h1>
          <p className="arcade-eyebrow arcade-insert text-sm md:text-base font-bold tracking-widest uppercase mb-2">
            ► INSERT LINK TO PLAY ◄
          </p>
        </motion.div>
      </header>

      {/* Main Interactive Console */}
      <section className="w-full max-w-3xl z-10 space-y-6 md:space-y-8" aria-label="Media Downloader Search">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <SearchBar onSearch={handleSearch} isLoading={isLoading} externalUrl={videoUrl} />
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-[#2b0f17] border-4 border-black text-red-300 text-center text-xs md:text-sm pixel-font-title shadow-[4px_4px_0_#000]"
              role="alert"
            >
              <span className="text-red-400 mr-2">⚠ ERROR:</span>
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
            <article key="content" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
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

        {/* Recent Searches (Save Slots) */}
        {recentVideos.length > 0 && !metadata && !isLoading && (
          <aside className="pt-6" aria-label="Recent Searches">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-yellow-300 pixel-font-title text-xs md:text-sm tracking-wider uppercase">
                <span>► RECENT SAVE SLOTS ◄</span>
              </div>
              <button
                onClick={clearHistory}
                className="text-red-400 hover:text-red-300 pixel-font-title text-[10px] md:text-xs tracking-wider uppercase flex items-center gap-1.5 transition-colors bg-black/40 px-2.5 py-1.5 border border-black shadow-[2px_2px_0_#000]"
                aria-label="Clear history"
              >
                <X className="w-3.5 h-3.5" /> CLEAR ALL
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {recentVideos.map((video, idx) => (
                <motion.button
                  key={video.title + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleHistoryClick(video)}
                  className="pixel-card p-3 flex items-center gap-3 text-left group cursor-pointer"
                >
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-16 md:w-20 h-10 md:h-12 object-cover border-2 border-black opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`pixel-badge platform-${video.platform || "youtube"}`}>
                        {video.platform || "youtube"}
                      </span>
                    </div>
                    <p className="text-white font-bold text-xs truncate pixel-font-body group-hover:text-yellow-300 transition-colors">
                      {video.title}
                    </p>
                    <p className="text-white/40 text-[11px] truncate pixel-font-code">
                      {video.author}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-purple-400/40 group-hover:text-yellow-400 transition-colors shrink-0" />
                </motion.button>
              ))}
            </div>
          </aside>
        )}
      </section>

      <Features />
    </main>

    {/* Arcade Footer */}
    <Footer />
    </>
  );
}
