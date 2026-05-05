"use client";

import { VideoMetadata } from "@/lib/downloader";
import { Play, User } from "lucide-react";

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  // Obtenemos la inicial como fallback absoluto
  const authorInitial = metadata.author.charAt(0).toUpperCase();
  
  // Limpiamos el nombre del autor para la búsqueda del avatar (quitamos espacios y VEVO si molesta)
  const searchName = metadata.author.replace(/\s+/g, '').replace(/VEVO$/i, '');
  const avatarUrl = `https://unavatar.io/youtube/${searchName}`;

  return (
    <div className="glass-card rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative group">
      {/* Subtle accent light */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors" />
      
      <div className="relative w-full md:w-64 h-36 md:h-40 flex-shrink-0">
        <img
          src={metadata.thumbnail}
          alt={metadata.title}
          className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10"
        />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <Play className="w-5 h-5 text-purple-500 fill-purple-500" />
        </div>
      </div>
      
      <div className="flex-1 text-center md:text-left min-w-0">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight text-white group-hover:text-purple-300 transition-colors line-clamp-2">
          {metadata.title}
        </h2>
        
        <div className="flex items-center justify-center md:justify-start gap-3">
          {/* Real Author Profile Picture with Unavatar fallback */}
          <div className="relative w-12 h-12 flex-shrink-0">
            <img 
              src={avatarUrl} 
              alt={metadata.author}
              onError={(e) => {
                // Si falla unavatar, mostramos el degradado con la inicial
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.querySelector('.fallback-avatar')!.classList.remove('hidden');
              }}
              className="w-full h-full rounded-full object-cover border-2 border-purple-500/50 shadow-lg"
            />
            {/* Fallback Hidden by default */}
            <div className="fallback-avatar hidden w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg border border-white/20">
              {authorInitial}
            </div>
            
            <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-1 border border-[#030303]">
              <User className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          
          <div className="flex flex-col items-start">
            <span className="text-white font-semibold text-sm">{metadata.author}</span>
            <span className="text-white/30 text-[10px] uppercase tracking-tighter font-medium">Verified Creator</span>
          </div>
        </div>
      </div>
    </div>
  );
}
