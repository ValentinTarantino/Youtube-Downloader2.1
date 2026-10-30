"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDownload } from "../context/DownloadContext";
import { VideoMetadata, DownloadOptions as DLOptions } from "../lib/downloader";

interface DownloadOptionsProps {
  url: string;
  metadata: VideoMetadata;
}

// ── Pixel art icons ──────────────────────────────────────────────────────────
// Each icon is an 8×8 grid of 1×1 rects. imageRendering:pixelated keeps edges crisp.

function PixelDownload({ className }: { className?: string }) {
  const px: [number, number][] = [
    // shaft
    [3,0],[4,0],[3,1],[4,1],[3,2],[4,2],
    // arrowhead
    [1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
    [2,4],[3,4],[4,4],[5,4],
    [3,5],[4,5],
    // tray base
    [0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],
  ];
  return (
    <svg viewBox="0 0 8 8" className={className} style={{ imageRendering: "pixelated" }}>
      {px.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}

function PixelMusic({ className }: { className?: string }) {
  const px: [number, number][] = [
    // beam (top horizontal bar)
    [2,0],[3,0],[4,0],[5,0],[6,0],
    // left stem
    [2,1],[2,2],
    // right stem
    [6,1],[6,2],
    // left note head
    [0,3],[1,3],[2,3],
    [0,4],[1,4],[2,4],
    // right note head
    [4,3],[5,3],[6,3],
    [4,4],[5,4],[6,4],
  ];
  return (
    <svg viewBox="0 0 8 8" className={className} style={{ imageRendering: "pixelated" }}>
      {px.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}

function PixelPlay({ className }: { className?: string }) {
  const px: [number, number][] = [
    [1,0],
    [1,1],[2,1],
    [1,2],[2,2],[3,2],
    [1,3],[2,3],[3,3],[4,3],[5,3],
    [1,4],[2,4],[3,4],
    [1,5],[2,5],
    [1,6],
  ];
  return (
    <svg viewBox="0 0 8 8" className={className} style={{ imageRendering: "pixelated" }}>
      {px.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}

function PixelHeadphones({ className }: { className?: string }) {
  const px: [number, number][] = [
    // headband
    [2,0],[3,0],[4,0],[5,0],
    [1,1],[6,1],
    [0,2],[7,2],
    // ear cups
    [0,3],[1,3],[6,3],[7,3],
    [0,4],[1,4],[6,4],[7,4],
    [0,5],[1,5],[6,5],[7,5],
    [1,6],[6,6],
  ];
  return (
    <svg viewBox="0 0 8 8" className={className} style={{ imageRendering: "pixelated" }}>
      {px.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    </svg>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DownloadOptions({ url, metadata }: DownloadOptionsProps) {
  const { addDownloadTask } = useDownload();
  const [videoQuality, setVideoQuality] = useState<DLOptions["quality"]>("720");
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
      {metadata.platform === "youtube" && (
        <fieldset className="glass-card rounded-3xl p-4 md:p-5" aria-label="Video quality">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
            {([
              { value: "1080", label: "Full HD", detail: "More detail" },
              { value: "720",  label: "HD",      detail: "Balanced"    },
              { value: "480",  label: "SD",       detail: "Smaller file"},
              { value: "360",  label: "Low",      detail: "Save data"  },
            ] as const).map(option => {
              const isSelected = videoQuality === option.value;
              return (
              <label key={option.value} className="relative cursor-pointer min-w-0">
                <input type="radio" name="video-quality" value={option.value}
                  checked={isSelected}
                  onChange={() => setVideoQuality(option.value)}
                  className="peer sr-only" />
                <span className="flex h-full min-h-24 flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.07] peer-checked:border-purple-400 peer-checked:bg-purple-500/15 peer-focus-visible:ring-2 peer-focus-visible:ring-purple-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black">
                  <span className={`text-lg font-bold ${isSelected ? "text-pink-300" : "text-white"}`}>{option.value}p</span>
                  <span className={`text-xs font-semibold ${isSelected ? "text-pink-200" : "text-purple-200"}`}>{option.label}</span>
                  <span className={`text-xs ${isSelected ? "text-pink-300/80" : "text-white/60"}`}>{option.detail}</span>
                </span>
              </label>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/50">If this quality is unavailable, the provider may use the nearest lower resolution.</p>
        </fieldset>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Video Download Card */}
        <div className="glass-card rounded-3xl p-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 hover:border-purple-500/30 transition-all">
          <div className="flex items-center gap-2 md:gap-4 p-2 md:p-4 min-w-0 flex-1">
            <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-blue-600 shrink-0">
              <PixelPlay className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-sm md:text-base">
                {metadata.platform === "youtube" ? "Video MP4" : "No Watermark"}
              </span>
              <span className="text-white/60 text-sm">
                {metadata.platform === "youtube" ? videoQuality + "p selected" : "Original Quality"}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleDownload("video")}
            disabled={isRequesting}
            aria-label="Download video"
            className="premium-button h-[70px] md:h-[80px] w-[80px] md:w-[100px] rounded-2xl flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <PixelDownload className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Download</span>
              </>
            )}
          </button>
        </div>

        {/* Audio Download Card */}
        <div className={`glass-card rounded-3xl p-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 transition-all ${metadata.platform === "instagram" ? "opacity-30 pointer-events-none select-none" : "hover:border-pink-500/30"}`}>
          <div className="flex items-center gap-2 md:gap-4 p-2 md:p-4 min-w-0 flex-1">
            <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-pink-400 shrink-0">
              <PixelHeadphones className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-white text-sm md:text-base">Audio MP3</span>
              <span className="text-white/40 text-xs md:text-sm font-medium">
                {metadata.platform === "instagram" ? "Not available for Reels" : "High Quality (320kbps)"}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleDownload("audio")}
            disabled={isRequesting || metadata.platform === "instagram"}
            aria-label="Download audio mp3"
            className="pixel-btn pixel-btn-pink h-[70px] md:h-[80px] w-[80px] md:w-[100px] flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {isRequesting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <PixelMusic className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Audio</span>
              </>
            )}
          </button>
        </div>

      </div>

      <p className="text-center text-xs md:text-sm text-cyan-300 px-2">
        We recommend staying on this page until your download starts, especially on mobile.
      </p>
    </section>
  );
}
