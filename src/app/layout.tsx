import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DownloadProvider } from "../context/DownloadContext";
import DownloadManager from "../components/DownloadManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClipyDropy | Professional Media Downloader",
  description: "Download YouTube, TikTok, and Instagram content in high quality with a premium experience.",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="pixel-theme min-h-full flex flex-col bg-[#161523]">
        <DownloadProvider>
          {children}
          <DownloadManager />
        </DownloadProvider>
      </body>
    </html>
  );
}
