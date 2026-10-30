"use client";

import { useState, useEffect } from "react";
import { Search as SearchIcon, Loader2 as LoaderIcon, Terminal } from "lucide-react";

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
  externalUrl?: string;
}

export default function SearchBar({ onSearch, isLoading, externalUrl = "" }: SearchBarProps) {
  const [url, setUrl] = useState(externalUrl);

  useEffect(() => {
    if (externalUrl) {
      setUrl(externalUrl);
    }
  }, [externalUrl]);

  useEffect(() => {
    if (url === "" && !isLoading) {
      onSearch("");
    }
  }, [url, onSearch, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative group" role="search">
      <div className="relative flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <span 
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 font-bold pixel-font-code text-lg select-none pointer-events-none" 
            aria-hidden="true" 
          >
            &gt;
          </span>
          <input
            type="text"
            placeholder="INSERT URL: YouTube, TikTok, Instagram..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Video URL"
            className="pixel-input w-full h-11 md:h-12 pl-8 md:pl-9 pr-3"
          />
        </div>
        <button
          type="submit"
          aria-label="Search video"
          disabled={isLoading || !url.trim()}
          className="pixel-btn shrink-0 h-11 md:h-12 px-4 md:px-5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[112px]"
        >
          {isLoading ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span className="font-bold tracking-wider">START ►</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
