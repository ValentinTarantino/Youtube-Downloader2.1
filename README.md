# ClipDrop 🎬

**ClipDrop** is a premium, high-performance media downloader designed to provide a seamless experience for extracting content from **YouTube**, **TikTok**, and **Instagram**. Built with modern web technologies, it features a stunning dark-mode UI, real-time progress tracking, and robust cross-platform compatibility.

## Features

- **Multi-Platform Support**: Download high-quality video and audio from YouTube, TikTok (no watermark), and Instagram Reels.
- **Smart Metadata Extraction**: Automatically retrieves video titles, thumbnails, creator names, and profile pictures.
- **Cross-Browser Optimized**: Specifically engineered to work perfectly on Chrome, Firefox, and Safari using same-origin tunneling.
- **Dual-API Resiliency**: Implements a primary and fallback API system for Instagram to ensure maximum reliability.
- **Real-Time Progress**: Interactive polling system with visual progress bars and status updates.
- **Recent History**: Persistent local storage to keep track of your latest searches.
- **Premium UX**: Smooth animations with Framer Motion and Skeleton loaders for an elite feel.

## Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **API Integration**: 
  - RapidAPI (YouTube, TikTok, Instagram)
  - Custom internal API Tunneling for browser compatibility


## Security & Performance

- **Streaming Tunnel**: Files are streamed through a server-side route to bypass CORS and ensure correct file headers for browser "Save As" dialogs.
- **Rate Limiting Protection**: Integrated error handling for API quotas and HTML error responses.
- **SEO Optimized**: Fully configured metadata with unique title tags and descriptions for better search engine visibility.


