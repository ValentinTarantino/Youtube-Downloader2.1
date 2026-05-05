"use client";

import { useState } from "react";
import { Search as SearchIcon, Loader2 as LoaderIcon } from "lucide-react";

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative group" role="search">
      {/* Background Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-focus-within:opacity-60" aria-hidden="true" />
      
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <SearchIcon 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-white/30 group-focus-within:text-purple-400 transition-colors" 
            aria-hidden="true" 
          />
          <input
            type="url"
            placeholder="Paste YouTube link here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="YouTube Video URL"
            required
            className="w-full pl-10 md:pl-12 pr-4 py-4 md:py-5 rounded-2xl glass-input text-white placeholder:text-white/20 text-base md:text-lg outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          aria-label={isLoading ? "Searching..." : "Search video"}
          className="premium-button px-6 md:px-8 rounded-2xl disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 whitespace-nowrap min-w-[60px] md:min-w-[140px] transition-all"
        >
          {isLoading ? (
            <LoaderIcon className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="hidden md:inline font-bold uppercase tracking-wider text-sm">Search</span>
              <SearchIcon className="w-5 h-5 md:hidden" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
