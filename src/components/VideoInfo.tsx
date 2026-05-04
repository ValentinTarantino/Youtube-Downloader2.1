"use client";

import { VideoMetadata } from "../lib/downloader";

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mt-8 overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:bg-white/10 group animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row">
        <div className="relative w-full md:w-2/5 aspect-video md:aspect-auto overflow-hidden">
          <img 
            src={metadata.thumbnail} 
            alt={metadata.title} 
            className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
        </div>
        <div className="p-6 md:w-3/5 flex flex-col justify-center relative">
          <h2 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight">
            {metadata.title}
          </h2>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs text-white uppercase shadow-lg">
              {metadata.author.charAt(0)}
            </span>
            {metadata.author}
          </p>
        </div>
      </div>
    </div>
  );
}
