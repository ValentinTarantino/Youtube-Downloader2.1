"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim());
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="relative w-full max-w-2xl mx-auto group"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
      <div className="relative flex items-center w-full h-16 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl transition-all focus-within:border-white/30 focus-within:bg-black/80">
        <div className="flex items-center justify-center pl-6 pr-4">
          <Search className="w-6 h-6 text-gray-400" />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega el enlace de YouTube aquí..."
          className="w-full h-full bg-transparent text-white placeholder-gray-500 text-lg focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="h-full px-8 bg-white/10 hover:bg-white/20 text-white font-medium transition-colors border-l border-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Buscar"
          )}
        </button>
      </div>
    </form>
  );
}
