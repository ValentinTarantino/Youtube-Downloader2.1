"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { DownloadOptions, VideoMetadata } from "../lib/downloader";
import confetti from "canvas-confetti";

export interface DownloadTask {
  id: string;
  jobId: string;
  title: string;
  thumbnail: string;
  progress: number | null;
  status: string;
  downloadUrl?: string;
  type: "video" | "audio";
  error?: string;
  ticket?: string;
  filename?: string;
  createdAt?: number;
  hidden?: boolean;
  sourceKey?: string;
  pendingDownload?: boolean;
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
  const polling = useRef(new Set<string>());
  const [hydrated, setHydrated] = useState(false);


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
        tasksRef.current = valid;
        setTasks(valid);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Save tasks to localStorage on update
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks, hydrated]);

  const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
    const next = tasksRef.current.map(t => t.id === id ? { ...t, ...updates } : t);
    tasksRef.current = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setTasks(next);
  }, []);

  // Central polling function for a single ticket
  const checkJobStatus = useCallback(
    async (task: DownloadTask) => {
      if (!task.ticket || task.status === "Ready" || task.status === "Error") return;
      if (polling.current.has(task.id)) return;
      polling.current.add(task.id);

      try {
        const res = await fetch(`/api/jobs?ticket=${encodeURIComponent(task.ticket)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) {
          // A temporary provider/network failure must not abandon a running job.
          if (res.status === 429 || res.status >= 500) return;
          const detail = await res.json().catch(() => null);
          updateTask(task.id, {
            status: "Error",
            hidden: false,
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
            pendingDownload: document.visibilityState !== "visible",
            hidden: false,
          });

          triggerConfetti();

          // Haptic feedback on mobile
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([150, 80, 150]);
            } catch {}
          }

          if (document.visibilityState === "visible") triggerDownload(dlUrl, finalFilename);
        } else if (data.status === "failed" || data.status === "deleted") {
          updateTask(task.id, {
            status: "Error",
            hidden: false,
            error: data.error || "The provider could not prepare the file.",
          });
        } else {
          // Ongoing progress
          updateTask(task.id, {
            progress: typeof data.progress === "number" && Number.isFinite(data.progress) && data.progress >= 0 && data.progress <= 100 ? data.progress : null,
            status: data.status === "queued" ? "Queued" : "Processing",
          });
        }
      } catch (err) {
        console.warn("[JOB POLL WARNING]", err);
      } finally {
        polling.current.delete(task.id);
      }
    },
    [updateTask]
  );

  // Poll all currently active tasks
  const pollActiveTasks = useCallback(() => {
    if (navigator.onLine === false) return;
    const current = tasksRef.current;
    for (const task of current) {
      if (task.pendingDownload && task.downloadUrl && document.visibilityState === "visible") {
        updateTask(task.id, { pendingDownload: false, hidden: false });
        triggerDownload(task.downloadUrl, task.filename);
      }
      if (task.ticket && task.status !== "Ready" && task.status !== "Error") {
        checkJobStatus(task);
      }
    }
  }, [checkJobStatus, updateTask]);

  // Provider jobs run independently. Browser timers may stop when a phone sleeps.
  useEffect(() => {
    if (!hydrated) return;
    const wake = () => { if (document.visibilityState === "visible") pollActiveTasks(); };
    pollActiveTasks();
    const timer = setInterval(pollActiveTasks, 2500);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
    };
  }, [pollActiveTasks, hydrated]);

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
            keepalive: true,
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
            progress: null,
          });


          // Perform initial check immediately
          checkJobStatus({
            id,
            jobId: "",
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            progress: null,
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
        hidden: false,
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
    const sourceKey = JSON.stringify([url, type, quality || "720"]);
    const existing = tasksRef.current.find(task => task.sourceKey === sourceKey && task.status !== "Error"
      && (!task.ticket || Number(task.ticket.split(".")[1]) > Date.now()));
    if (existing) {
      updateTask(existing.id, { hidden: false });
      if (existing.status === "Ready" && existing.downloadUrl) triggerDownload(existing.downloadUrl, existing.filename);
      else if (existing.ticket) void checkJobStatus(existing);
      return;
    }
    const id = Math.random().toString(36).substring(2, 11);
    const newTask: DownloadTask = {
      id,
      jobId: "",
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      progress: null,
      status: "Starting...",
      type,
      createdAt: Date.now(),
      sourceKey,
    };

    tasksRef.current = [newTask, ...tasksRef.current];
    setTasks(tasksRef.current);

    // Dispatch background process immediately without blocking UI
    processTask(id, url, metadata, type, quality);
  };

  const removeTask = (id: string) => {
    // Dismiss the notification without deleting the provider job's tracking state.
    // Completion brings the download action back, including after a page reload.
    updateTask(id, { hidden: true });
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
