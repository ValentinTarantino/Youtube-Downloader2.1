"use client";

import { ArrowUp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full z-10">
      {/* Pixel accent strip */}
      <div className="flex h-1.5 w-full" aria-hidden="true">
        <div className="flex-1 bg-[#facc15]" />
        <div className="flex-1 bg-[#ec4899]" />
        <div className="flex-1 bg-[#22d3ee]" />
      </div>

      {/* Dark band: contrasts with the brick background */}
      <div className="w-full bg-[#080510] border-t-4 border-black">
        <div className="mx-auto max-w-5xl px-4 md:px-20 py-8 md:py-10">
          <div className="grid gap-12 md:gap-12 md:grid-cols-12 text-center md:text-left">
            {/* Brand */}
            <div className="md:col-span-5">
              <h3 className="pixel-font-title text-yellow-300 text-sm md:text-lg tracking-wider uppercase">
                ► Clipydropy ◄
              </h3>
              <p className="mt-5 pixel-font-body text-xs md:text-sm leading-relaxed text-pink-200/80 max-w-sm mx-auto md:mx-0">
                Free 16-bit media extractor for YouTube, TikTok and Instagram.
                No install, no signup — just paste a link and press START.
              </p>
            </div>

            {/* Platforms */}
            <div className="md:col-span-3">
              <h4 className="pixel-font-title text-cyan-300 text-xs md:text-sm tracking-wider uppercase">
                Supported platforms
              </h4>
              <ul className="mt-5 space-y-3.5 pixel-font-body text-xs md:text-sm">
                <li className="flex items-center justify-center md:justify-start gap-3 text-pink-200/80">
                  <span className="w-3 h-3 bg-[#9f1239] border border-black shrink-0" aria-hidden="true" />
                  YouTube
                </li>
                <li className="flex items-center justify-center md:justify-start gap-3 text-pink-200/80">
                  <span className="w-3 h-3 bg-[#22d3ee] border border-black shrink-0" aria-hidden="true" />
                  TikTok
                </li>
                <li className="flex items-center justify-center md:justify-start gap-3 text-pink-200/80">
                  <span className="w-3 h-3 bg-[#ec4899] border border-black shrink-0" aria-hidden="true" />
                  Instagram
                </li>
              </ul>
            </div>

            {/* Quick facts */}
            <div className="md:col-span-4">
              <h4 className="pixel-font-title text-xs md:text-sm tracking-wider uppercase text-cyan-300">
                Quick facts
              </h4>
              <ul className="mt-5 space-y-3.5 pixel-font-body text-xs md:text-sm text-pink-200/80">
                <li>100% free &amp; unlimited</li>
                <li>No software installation</li>
                <li>Works on every device</li>
                <li>Up to 1080p HD with audio</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 md:mt-10 flex justify-center">
            <a
              href="#top"
              className="pixel-btn inline-flex items-center justify-center gap-2 px-5 py-3 text-xs!"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
              <span>Back to top</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
