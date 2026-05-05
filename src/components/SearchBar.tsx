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
    // Enviamos la URL aunque esté vacía para que la página principal maneje el "reset"
    onSearch(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-purple-400 transition-colors" />
          <input
            type="text"
            placeholder="Paste YouTube link here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full pl-12 pr-4 py-5 rounded-2xl glass-input text-white placeholder:text-white/20 text-lg"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="premium-button px-8 rounded-2xl disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            <LoaderIcon className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="hidden md:inline">Search Video</span>
              <SearchIcon className="w-5 h-5 md:hidden" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
