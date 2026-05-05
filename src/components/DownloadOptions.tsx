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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Video Download Card */}
        <div className="glass-card rounded-3xl p-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Video className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white">Video MP4</span>
              <div className="relative inline-block group">
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value as DLOptions["quality"])}
                  className="bg-transparent text-white/40 text-sm font-medium outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-6"
                >
                  <option value="1080" className="bg-[#111]">1080p (Full HD)</option>
                  <option value="720" className="bg-[#111]">720p (HD)</option>
                  <option value="480" className="bg-[#111]">480p (SD)</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDownload("video")}
            disabled={isRequesting}
            className="premium-button h-[80px] w-[100px] rounded-2xl flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Download</span>
              </>
            )}
          </button>
        </div>

        {/* Audio Download Card */}
        <div className="glass-card rounded-3xl p-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Music className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white">Audio MP3</span>
              <span className="text-white/40 text-sm font-medium">High Quality (320kbps)</span>
            </div>
          </div>
          <button
            onClick={() => handleDownload("audio")}
            disabled={isRequesting}
            className="h-[80px] w-[100px] rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Audio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
