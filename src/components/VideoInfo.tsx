"use client";

import { VideoMetadata } from "../lib/downloader";
import { Play, CheckCircle, Film, Music2, Video } from "lucide-react";

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  const safeAuthor = String(metadata.author || "Creator");

  const avatarUrl =
    metadata.authorAvatar ||
    (metadata.platform === "youtube"
      ? `https://unavatar.io/youtube/${encodeURIComponent(safeAuthor)}`
      : metadata.platform === "tiktok"
        ? `https://unavatar.io/tiktok/${encodeURIComponent(safeAuthor)}`
        : `https://unavatar.io/instagram/${encodeURIComponent(safeAuthor)}`);

  const hasThumbnail = metadata.thumbnail && metadata.thumbnail.trim().length > 0;

  const placeholderGradient =
    metadata.platform === "youtube"
      ? "from-red-900/60 to-red-950/80"
      : metadata.platform === "tiktok"
        ? "from-pink-900/60 to-slate-950/80"
        : "from-purple-900/60 via-pink-900/60 to-orange-900/60";

  const PlatformIcon =
    metadata.platform === "youtube"
      ? Video
      : metadata.platform === "instagram"
        ? Film
        : Music2;

  return (
    <article className="glass-card rounded-3xl p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8 items-center overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors" aria-hidden="true" />

      {/* Thumbnail */}
      <div className="relative w-full md:w-64 aspect-video md:h-40 flex-shrink-0">
        {hasThumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const placeholder = parent.querySelector(".ig-placeholder") as HTMLElement;
                if (placeholder) placeholder.style.display = "flex";
              }
            }}
          />
        ) : null}

        <div
          className={`ig-placeholder w-full h-full bg-gradient-to-br ${placeholderGradient} rounded-2xl flex flex-col items-center justify-center gap-2 border border-white/10 ${hasThumbnail ? "hidden" : "flex"}`}
        >
          <PlatformIcon className="w-10 h-10 text-white/40" />
          <span className="text-white/30 text-xs font-bold uppercase tracking-widest">
            {metadata.platform}
          </span>
        </div>

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <Play className="w-5 h-5 text-purple-500 fill-purple-500" />
        </div>
      </div>

      <div className="flex-1 text-center md:text-left min-w-0">
        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest font-bold text-white/50">
            {metadata.platform}
          </span>
        </div>
        <h2 className="text-lg md:text-2xl lg:text-3xl font-bold mb-4 leading-tight text-white group-hover:text-purple-300 transition-colors line-clamp-2">
          {metadata.title}
        </h2>

        <div className="flex items-center justify-center md:justify-start gap-3">
          <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
            <img
              src={avatarUrl}
              alt={safeAuthor}
              className="w-full h-full rounded-full object-cover border-2 border-purple-500/30 shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(safeAuthor)}&background=8B5CF6&color=fff&bold=true`;
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#0A0A0A]">
              <CheckCircle className="w-2 md:w-3 h-2 md:h-3 text-white fill-white" />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-white font-bold text-sm md:text-base tracking-tight">
              {safeAuthor}
            </span>
            <span className="text-white/30 text-[9px] md:text-[10px] uppercase font-bold tracking-widest">
              Verified Creator
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
