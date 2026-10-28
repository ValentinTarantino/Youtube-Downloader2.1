"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { DownloadOptions, VideoMetadata } from "../lib/downloader";
import confetti from "canvas-confetti";

export interface DownloadTask {
  id: string;
  jobId: string;
  title: string;
  thumbnail: string;
  progress: number;
  status: string;
  downloadUrl?: string;
  type: "video" | "audio";
  error?: string;
}

interface DownloadContextType {
  tasks: DownloadTask[];
  addDownloadTask: (url: string, metadata: VideoMetadata, type: "video" | "audio", quality: DownloadOptions["quality"]) => Promise<void>;
  removeTask: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  const triggerConfetti = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ["#8B5CF6", "#3B82F6", "#10B981"] });
  };

  const triggerDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const addDownloadTask = async (
    url: string,
    metadata: VideoMetadata,
    type: "video" | "audio",
    _quality: DownloadOptions["quality"]
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    setTasks((prev) => [{ id, jobId: "", title: metadata.title, thumbnail: metadata.thumbnail, progress: 15, status: "Preparing...", type }, ...prev]);

    try {
      if (metadata.platform === "youtube") {
        const tunnelUrl = `/api/download?url=${encodeURIComponent(url)}&type=${type}&quality=${_quality || "720"}&filename=${encodeURIComponent(metadata.title)}`;
        triggerDownload(tunnelUrl);

        setTimeout(() => {
          updateTask(id, { progress: 65, status: "Downloading..." });
        }, 1200);

        setTimeout(() => {
          updateTask(id, { progress: 100, status: "Ready", downloadUrl: tunnelUrl });
          triggerConfetti();
        }, 3000);
        return;
      }

      if (metadata.platform === 'tiktok' || metadata.platform === 'instagram') {
        let directUrl = "";

        if (metadata.directUrls) {
          if (type === "video" && metadata.directUrls.video) {
            directUrl = metadata.directUrls.video;
          } else if (type === "audio" && metadata.directUrls.audio) {
            directUrl = metadata.directUrls.audio;
          } else if (type === "audio" && metadata.directUrls.video) {
            directUrl = metadata.directUrls.video;
          }
        }

        if (directUrl) {
          const tunnelUrl = `/api/download?url=${encodeURIComponent(directUrl)}&type=${type}&filename=${encodeURIComponent(metadata.title)}`;
          updateTask(id, { progress: 100, status: "Ready", downloadUrl: tunnelUrl });
          triggerConfetti();
          triggerDownload(tunnelUrl);
          return;
        }

        throw new Error("No download link available for this post.");
      }
    } catch (error) {
      updateTask(id, { status: "Error", error: (error as Error).message });
    }
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <DownloadContext.Provider value={{ tasks, addDownloadTask, removeTask }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useDownload must be used within DownloadProvider");
  return context;
}
