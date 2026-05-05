"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { checkDownloadProgress, requestDownload, DownloadOptions, VideoMetadata } from "../lib/downloader";
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
    window.location.assign(url);
  };

  const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const addDownloadTask = async (
    url: string,
    metadata: VideoMetadata,
    type: "video" | "audio",
    quality: DownloadOptions["quality"]
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    setTasks((prev) => [{ id, jobId: "", title: metadata.title, thumbnail: metadata.thumbnail, progress: 0, status: "Starting...", type }, ...prev]);

    try {
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

      const { jobId } = await requestDownload({
        url,
        isAudioOnly: type === "audio",
        quality: type === "video" ? quality : "720",
      });

      updateTask(id, { jobId, status: "Processing..." });

      let finalLink = "";

      const initial = await checkDownloadProgress(jobId);
      if (initial.downloadUrl) {
        finalLink = initial.downloadUrl;
      } else {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const status = await checkDownloadProgress(jobId);
          const prog = status.progress > 100 ? Math.floor(status.progress / 10) : (status.progress || 0);
          updateTask(id, { progress: Math.min(prog, 99), status: status.status || "Converting..." });

          if (status.downloadUrl) {
            finalLink = status.downloadUrl;
            break;
          }
          if (status.status === "ERROR") throw new Error("Conversion failed. Try again.");
        }
      }

      if (!finalLink) throw new Error("Conversion timed out. Please try again.");

      const tunnelUrl = `/api/download?url=${encodeURIComponent(finalLink)}&type=${type}&filename=${encodeURIComponent(metadata.title)}`;
      updateTask(id, { progress: 100, status: "Ready", downloadUrl: tunnelUrl });
      triggerConfetti();
      triggerDownload(tunnelUrl);

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
