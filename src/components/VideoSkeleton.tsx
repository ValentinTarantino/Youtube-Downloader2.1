"use client";

import { motion } from "framer-motion";

export default function VideoSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center animate-pulse">
      {/* Thumbnail Skeleton */}
      <div className="w-full md:w-64 h-36 md:h-40 bg-white/5 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
      
      {/* Text Skeleton */}
      <div className="flex-1 w-full space-y-4">
        <div className="h-8 bg-white/5 rounded-lg w-3/4" />
        <div className="h-8 bg-white/5 rounded-lg w-1/2" />
        <div className="flex items-center gap-3 mt-4">
          <div className="w-10 h-10 rounded-full bg-white/5" />
          <div className="h-4 bg-white/5 rounded-lg w-32" />
        </div>
      </div>
    </div>
  );
}
