"use client";

import { useDownload, DownloadTask } from "../context/DownloadContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Loader2, Music, Video, Download } from "lucide-react";
import { useEffect, useState } from "react";

export default function DownloadManager() {
  const { tasks, removeTask } = useDownload();

  if (tasks.length === 0) return null;

  return (
    <div 
      className="download-notifications fixed bottom-4 right-4 left-4 md:left-auto md:bottom-6 md:right-6 z-50 flex flex-col gap-3 pointer-events-none overflow-y-auto overscroll-contain max-h-[70vh] w-auto md:w-[330px]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {tasks.filter((task) => !task.hidden).map((task) => (
          <DownloadItem key={task.id} task={task} onRemove={() => removeTask(task.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function DownloadItem({ task, onRemove }: { task: DownloadTask; onRemove: () => void }) {
  const isDone = task.status === "Ready";
  const isError = task.status === "Error";
  const isProcessing = !isDone && !isError;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isProcessing || !task.createdAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - task.createdAt!) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isProcessing, task.createdAt]);
  const stage = task.status === "Queued" ? "Queued" : task.status === "Starting..." ? "Starting" : "Preparing file";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="pointer-events-auto relative flex shrink-0 flex-col overflow-hidden bg-[#132a52] border-[3px] border-blue-400 shadow-[5px_5px_0_0_#000]"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between bg-[#1c3f7a] border-b-[3px] border-blue-400 pl-3 pr-1 py-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-100">
          {isDone ? "Download ready" : isError ? "Download failed" : "Download"}
        </span>
        <button
          onClick={onRemove}
          aria-label="Hide notification; preparation continues"
          title="Hide notification; preparation continues"
          className="w-7 h-7 flex items-center justify-center text-blue-200/70 hover:text-white hover:bg-blue-400/30 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative flex gap-3 p-3">
        {isProcessing && task.progress !== null && (
          <motion.div
            className="absolute inset-0 bg-blue-300/10 origin-left pointer-events-none"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: task.progress / 100 }}
            transition={{ duration: 0.5 }}
            aria-hidden="true"
          />
        )}

        <div className="relative w-11 h-11 md:w-14 md:h-14 overflow-hidden flex-shrink-0 border-2 border-blue-400/60 bg-[#0b1830]">
          <img src={task.thumbnail} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-[#0b1830]/55 flex items-center justify-center">
            {task.type === "audio" ? (
              <Music className="w-4 h-4 text-blue-100" />
            ) : (
              <Video className="w-4 h-4 text-blue-100" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="text-white text-[13px] font-bold leading-snug line-clamp-2">
            {task.title}
          </h4>

          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-[0.15em] ${
              isDone
                ? "bg-blue-400/25 border-blue-300/60 text-blue-50"
                : isError
                  ? "bg-red-500/20 border-red-400/60 text-red-200"
                  : "bg-blue-500/15 border-blue-400/40 text-blue-200"
            }`}>
              {isProcessing && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {isDone && <CheckCircle2 className="w-2.5 h-2.5" />}
              {isError && <AlertCircle className="w-2.5 h-2.5" />}
              {isDone ? "File ready" : isError ? "Error" : `${stage}${task.progress !== null ? ` ${Math.round(task.progress)}%` : ""}`}
            </span>
          </div>

          {isProcessing && (
            <p className="mt-2 text-[11px] leading-relaxed text-blue-100/60">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed · your download will start when the file is ready.
            </p>
          )}
          {isProcessing && (
            <p className="mt-1 text-[11px] leading-relaxed text-cyan-300">
              We recommend staying on this page until your download starts, especially on mobile.
            </p>
          )}
          {isDone && (
            <p className="mt-2 text-[11px] leading-relaxed text-blue-100/60">
              Check your browser downloads. If the download has not started, use the button below.
            </p>
          )}

          {isError && task.error && (
            <p className="mt-2 text-[11px] leading-relaxed text-red-300 break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
              {task.error}
            </p>
          )}

          {isDone && task.downloadUrl && (
            <a
              href={task.downloadUrl}
              download
              className="mt-2.5 min-h-10 w-full py-2 px-3 bg-blue-500 hover:bg-blue-400 active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000] text-white font-bold text-[11px] uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 shadow-[3px_3px_0_0_#000] transition-all text-center pointer-events-auto"
              aria-label="Download ready file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
