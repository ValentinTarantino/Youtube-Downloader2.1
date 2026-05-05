"use client";

import { VideoMetadata } from "../lib/downloader";
import { Play, User, CheckCircle, Video, Music } from "lucide-react";

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  const authorInitial = metadata.author.charAt(0).toUpperCase();
  const searchName = metadata.author.replace(/\s+/g, '').replace(/VEVO$/i, '');
  const avatarUrl = metadata.platform === 'youtube' 
    ? `https://unavatar.io/youtube/${searchName}`
    : `https://unavatar.io/tiktok/${searchName}`;

  return (
    <article className="glass-card rounded-3xl p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8 items-center overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors" aria-hidden="true" />
      
      <div className="relative w-full md:w-64 aspect-video md:h-40 flex-shrink-0">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt={`Thumbnail of ${metadata.title}`}
            className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10"
          />
        ) : (
          <div className="w-full h-full bg-white/5 rounded-2xl flex items-center justify-center">
            {metadata.platform === 'youtube' ? <Video className="w-8 h-8 text-white/20" /> : <Music className="w-8 h-8 text-white/20" />}
          </div>
        )}
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
            {metadata.authorAvatar ? (
               <img 
               src={metadata.authorAvatar} 
               alt={metadata.author}
               className="w-full h-full rounded-full object-cover border-2 border-purple-500/30 shadow-lg"
             />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg border border-white/20">
                {authorInitial}
              </div>
            )}
            
            <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-1 border border-[#030303]">
              <User className="w-2 h-2 md:w-2.5 md:h-2.5 text-white" />
            </div>
          </div>
          
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold text-xs md:text-sm truncate max-w-[150px] md:max-w-none">
                {metadata.author}
              </span>
              <CheckCircle className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-white/30 text-[9px] md:text-[10px] uppercase tracking-wider font-bold">
              {metadata.platform === 'youtube' ? 'Verified Creator' : 'Social Media Creator'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
