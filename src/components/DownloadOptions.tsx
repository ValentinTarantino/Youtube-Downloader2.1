"use client";

import { Download, Music, Video, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useDownload } from "../context/DownloadContext";
import { VideoMetadata, DownloadOptions as DLOptions } from "../lib/downloader";

interface DownloadOptionsProps {
  url: string;
  metadata: VideoMetadata;
}

export default function DownloadOptions({ url, metadata }: DownloadOptionsProps) {
  const { addDownloadTask } = useDownload();
  const [videoQuality, setVideoQuality] = useState<DLOptions["quality"]>("1080");
  const [isRequesting, setIsRequesting] = useState(false);

  const handleDownload = async (type: "video" | "audio") => {
    setIsRequesting(true);
    try {
      await addDownloadTask(url, metadata, type, videoQuality);
    } catch (err) {
      console.error("Download request failed:", err);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Available download options">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Video Download Card */}
        <div className="glass-card rounded-3xl p-2 flex items-center justify-between gap-2 hover:border-purple-500/30 transition-all">
          <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Video className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-sm md:text-base">
                {metadata.platform === 'youtube' ? 'Video MP4' : 'No Watermark'}
              </span>
              <div className="relative inline-block group">
                {metadata.platform === 'youtube' ? (
                  <>
                    <select
                      value={videoQuality}
                      onChange={(e) => setVideoQuality(e.target.value as DLOptions["quality"])}
                      aria-label="Select video quality"
                      className="bg-transparent text-white/40 text-xs md:text-sm font-medium outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-5"
                    >
                      <option value="1080" className="bg-[#111]">1080p (Full HD)</option>
                      <option value="720" className="bg-[#111]">720p (HD)</option>
                      <option value="480" className="bg-[#111]">480p (SD)</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  </>
                ) : (
                  <span className="text-white/40 text-xs md:text-sm font-medium">Original Quality</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDownload("video")}
            disabled={isRequesting}
            aria-label={`Download video`}
            className="premium-button h-[70px] md:h-[80px] w-[80px] md:w-[100px] rounded-2xl flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider">Download</span>
              </>
            )}
          </button>
        </div>

        {/* Audio Download Card */}
        <div className="glass-card rounded-3xl p-2 flex items-center justify-between gap-2 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Music className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-sm md:text-base">Audio MP3</span>
              <span className="text-white/40 text-xs md:text-sm font-medium">High Quality (320kbps)</span>
            </div>
          </div>
          <button
            onClick={() => handleDownload("audio")}
            disabled={isRequesting}
            aria-label="Download audio mp3"
            className="h-[70px] md:h-[80px] w-[80px] md:w-[100px] rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider">Audio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
