"use client";

export default function VideoSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8 items-center animate-pulse" aria-hidden="true">
      {/* Thumbnail Skeleton */}
      <div className="w-full md:w-64 aspect-video md:h-40 bg-white/5 rounded-2xl relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
      
      {/* Text Skeleton */}
      <div className="flex-1 w-full space-y-4">
        <div className="h-6 md:h-8 bg-white/5 rounded-lg w-3/4" />
        <div className="h-6 md:h-8 bg-white/5 rounded-lg w-1/2" />
        <div className="flex items-center gap-3 mt-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5" />
          <div className="space-y-2">
            <div className="h-3 md:h-4 bg-white/5 rounded-lg w-24 md:w-32" />
            <div className="h-2 md:h-3 bg-white/5 rounded-lg w-16 md:w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
