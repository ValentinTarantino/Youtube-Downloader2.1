"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  ticket?: string;
  filename?: string;
  createdAt?: number;
}

interface DownloadContextType {
  tasks: DownloadTask[];
  addDownloadTask: (
    url: string,
    metadata: VideoMetadata,
    type: "video" | "audio",
    quality: DownloadOptions["quality"]
  ) => Promise<void>;
  removeTask: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);
const STORAGE_KEY = "clipdrop_tasks_v2";

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const tasksRef = useRef<DownloadTask[]>([]);
  tasksRef.current = tasks;

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#8B5CF6", "#3B82F6", "#10B981"],
    });
  };

  const triggerDownload = (url: string, filename = "") => {
    try {
      const link = document.createElement("a");
      link.href = url;
      if (filename) link.setAttribute("download", filename);
      link.setAttribute("target", "_self");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn("[DOWNLOAD TRIGGER ERROR]", err);
    }
  };

  // Load persisted tasks on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: DownloadTask[] = JSON.parse(saved);
        const dayAgo = Date.now() - 24 * 3600 * 1000;
        const valid = parsed.filter((t) => (t.createdAt || 0) > dayAgo);
        setTasks(valid);
      }
    } catch {}
  }, []);

  // Save tasks to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Central polling function for a single ticket
  const checkJobStatus = useCallback(
    async (task: DownloadTask) => {
      if (!task.ticket || task.status === "Ready" || task.status === "Error") return;

      try {
        const res = await fetch(`/api/jobs?ticket=${encodeURIComponent(task.ticket)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          updateTask(task.id, {
            status: "Error",
            error: detail?.error || "Error checking status.",
          });
          return;
        }

        const data = await res.json();

        if (data.status === "completed" && data.downloadUrl) {
          const dlUrl = `/api/jobs?ticket=${encodeURIComponent(task.ticket)}&download=1`;
          const finalFilename =
            task.filename ||
            `${task.title.replace(/[<>:"/\\|?*]/g, "_")}.${task.type === "audio" ? "mp3" : "mp4"}`;

          updateTask(task.id, {
            progress: 100,
            status: "Ready",
            downloadUrl: dlUrl,
          });

          triggerConfetti();

          // Haptic feedback on mobile
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([150, 80, 150]);
            } catch {}
          }

          triggerDownload(dlUrl, finalFilename);
        } else if (data.status === "failed") {
          updateTask(task.id, {
            status: "Error",
            error: data.error || "The provider could not prepare the file.",
          });
        } else {
          // Ongoing progress
          updateTask(task.id, {
            progress: data.progress ? Math.min(Math.max(data.progress, 20), 90) : 35,
            status: data.status === "queued" ? "Queued" : "Processing",
          });
        }
      } catch (err) {
        console.warn("[JOB POLL WARNING]", err);
      }
    },
    [updateTask]
  );

  // Poll all currently active tasks
  const pollActiveTasks = useCallback(() => {
    const current = tasksRef.current;
    for (const task of current) {
      if (task.ticket && task.status !== "Ready" && task.status !== "Error") {
        checkJobStatus(task);
      }
    }
  }, [checkJobStatus]);

  // Background Web Worker ticker + VisibilityChange wake-up handler
  useEffect(() => {
    let worker: Worker | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    // Web Worker timer resists mobile tab throttle
    try {
      const code = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) timer = setInterval(function() { self.postMessage('tick'); }, 2500);
          } else if (e.data === 'stop') {
            if (timer) { clearInterval(timer); timer = null; }
          }
        };
      `;
      const blob = new Blob([code], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      worker.onmessage = () => {
        pollActiveTasks();
      };
      worker.postMessage("start");
    } catch {
      fallbackInterval = setInterval(pollActiveTasks, 2500);
    }

    // Wake-up immediately on tab return / mobile screen unlock
    const handleWakeup = () => {
      if (document.visibilityState === "visible") {
        pollActiveTasks();
      }
    };

    document.addEventListener("visibilitychange", handleWakeup);
    window.addEventListener("focus", handleWakeup);

    return () => {
      if (worker) {
        try {
          worker.postMessage("stop");
          worker.terminate();
        } catch {}
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
      document.removeEventListener("visibilitychange", handleWakeup);
      window.removeEventListener("focus", handleWakeup);
    };
  }, [pollActiveTasks]);

  // Execute processing in the background without blocking the UI
  const processTask = async (
    id: string,
    url: string,
    metadata: VideoMetadata,
    type: "video" | "audio",
    _quality: DownloadOptions["quality"]
  ) => {
    const cleanTitle = metadata.title.replace(/[<>:"/\\|?*]/g, "_");
    const extension = type === "audio" ? "mp3" : "mp4";
    const finalFilename = `${cleanTitle}.${extension}`;

    try {
      if (metadata.platform === "youtube") {
        // Step 1: Attempt fast async cloud job
        let jobResult: any = null;
        try {
          const created = await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              format: type === "audio" ? "mp3" : `${_quality || "720"}p`,
            }),
          });
          jobResult = await created.json().catch(() => null);
        } catch {}

        if (jobResult && !jobResult.unavailable && jobResult.ticket) {
          updateTask(id, {
            ticket: jobResult.ticket,
            filename: finalFilename,
            status: jobResult.status === "queued" ? "Queued" : "Processing",
            progress: 25,
          });

          // Perform initial check immediately
          checkJobStatus({
            id,
            jobId: "",
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            progress: 25,
            status: "Processing",
            type,
            ticket: jobResult.ticket,
            filename: finalFilename,
          });
          return;
        }

        // Step 2: Instant native tunnel fallback
        // Browser OS Download Manager streams directly; no in-memory blob buffering
        const tunnelUrl = `/api/download?url=${encodeURIComponent(url)}&type=${type}&quality=${_quality || "720"}&filename=${encodeURIComponent(metadata.title)}`;

        updateTask(id, {
          progress: 100,
          status: "Ready",
          downloadUrl: tunnelUrl,
          filename: finalFilename,
        });

        triggerDownload(tunnelUrl, finalFilename);
        triggerConfetti();
        return;
      }

      if (metadata.platform === "tiktok" || metadata.platform === "instagram") {
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
          updateTask(id, {
            progress: 100,
            status: "Ready",
            downloadUrl: tunnelUrl,
            filename: finalFilename,
          });
          triggerConfetti();
          triggerDownload(tunnelUrl, finalFilename);
          return;
        }

        throw new Error("No download link available for this post.");
      }
    } catch (error) {
      updateTask(id, {
        status: "Error",
        error: (error as Error).message,
      });
    }
  };

  const addDownloadTask = async (
    url: string,
    metadata: VideoMetadata,
    type: "video" | "audio",
    quality: DownloadOptions["quality"]
  ) => {
    const id = Math.random().toString(36).substring(2, 11);
    const newTask: DownloadTask = {
      id,
      jobId: "",
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      progress: 15,
      status: "Starting...",
      type,
      createdAt: Date.now(),
    };

    setTasks((prev) => [newTask, ...prev]);

    // Dispatch background process immediately without blocking UI
    processTask(id, url, metadata, type, quality);
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
