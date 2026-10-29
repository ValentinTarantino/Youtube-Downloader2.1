"use client";

import { useDownload, DownloadTask } from "../context/DownloadContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Loader2, Music, Video, Download } from "lucide-react";

export default function DownloadManager() {
  const { tasks, removeTask } = useDownload();

  if (tasks.length === 0) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 left-4 md:left-auto md:bottom-6 md:right-6 z-50 w-auto md:w-full md:max-w-[350px] flex flex-col gap-2 md:gap-3 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="pointer-events-auto glass-card rounded-2xl p-2 md:p-3 shadow-2xl border border-white/10 flex gap-3 overflow-hidden relative group"
    >
      {isProcessing && (
        <motion.div 
          className="absolute inset-0 bg-purple-500/10 origin-left pointer-events-none"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: task.progress / 100 }}
          transition={{ duration: 0.5 }}
          aria-hidden="true"
        />
      )}

      <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
        <img src={task.thumbnail} alt="" className="w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          {task.type === "audio" ? (
            <Music className="w-3 h-3 md:w-4 md:h-4 text-white/70" />
          ) : (
            <Video className="w-3 h-3 md:w-4 md:h-4 text-white/70" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-white text-[10px] md:text-xs font-bold truncate pr-6">
          {task.title}
        </h4>
        
        <div className="flex items-center gap-1.5 md:gap-2 mt-1">
          {isProcessing && <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-purple-400 animate-spin" />}
          {isDone && <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />}
          {isError && <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-400" />}
          
          <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${
            isDone ? "text-emerald-400" : isError ? "text-red-400" : "text-white/40"
          }`}>
            {isDone ? "Listo para descargar" : isError ? "Error" : `${task.status} ${task.progress}%`}
          </span>
        </div>

        {isError && task.error && (
          <p className="mt-2 text-xs text-red-300 break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
            {task.error}
          </p>
        )}

        {isDone && task.downloadUrl && (
          <a 
            href={task.downloadUrl}
            download
            className="mt-2 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-center pointer-events-auto"
            aria-label="Descargar archivo listo"
          >
            <Download className="w-3 md:w-3.5 h-3 md:h-3.5" />
            <span>Descargar Archivo</span>
          </a>
        )}
      </div>

      <button 
        onClick={onRemove}
        aria-label="Remove download notification"
        className="absolute top-1 right-1 md:top-2 md:right-2 text-white/20 hover:text-white transition-colors p-1"
      >
        <X className="w-3 h-3 md:w-4 md:h-4" />
      </button>
    </motion.div>
  );
}
