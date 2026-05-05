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
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#8B5CF6", "#3B82F6", "#10B981"],
    });
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

    const newTask: DownloadTask = {
      id,
      jobId: "",
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      progress: 0,
      status: "Starting...",
      type,
    };

    setTasks((prev) => [newTask, ...prev]);

    try {
      const { jobId } = await requestDownload({
        url,
        isAudioOnly: type === "audio",
        quality: type === "video" ? quality : "1080",
      });

      updateTask(id, { jobId, status: "Processing..." });

      let finalLink = "";

      const initialStatus = await checkDownloadProgress(jobId);
      if (initialStatus.downloadUrl) {
        finalLink = initialStatus.downloadUrl;
      } else {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const status = await checkDownloadProgress(jobId);

          const currentProgress = status.progress || 0;
          const prog = currentProgress > 100 ? Math.floor(currentProgress / 10) : currentProgress;

          updateTask(id, {
            progress: prog,
            status: status.status || "Converting..."
          });

          if (status.downloadUrl) {
            finalLink = status.downloadUrl;
            break;
          }

          if (status.status === "ERROR") {
            throw new Error("Server error");
          }
        }
      }

      if (finalLink) {
        updateTask(id, { progress: 100, status: "Ready", downloadUrl: finalLink });
        triggerConfetti();

        const link = document.createElement("a");
        link.href = finalLink;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("Timeout");
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
