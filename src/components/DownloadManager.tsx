"use client";

import { useDownload, DownloadTask } from "../context/DownloadContext";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Loader2, Music, Video, ExternalLink } from "lucide-react";

export default function DownloadManager() {
  const { tasks, removeTask } = useDownload();

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-[350px] flex flex-col gap-3 pointer-events-none">
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
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      layout
      className="pointer-events-auto glass-card rounded-2xl p-3 shadow-2xl border border-white/10 flex gap-3 overflow-hidden relative group"
    >
      {/* Background Progress Fill */}
      {isProcessing && (
        <motion.div 
          className="absolute inset-0 bg-purple-500/5 origin-left pointer-events-none"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: task.progress / 100 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Thumbnail */}
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
        <img src={task.thumbnail} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          {task.type === "audio" ? (
            <Music className="w-4 h-4 text-white/70" />
          ) : (
            <Video className="w-4 h-4 text-white/70" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-white text-xs font-bold truncate pr-4">
          {task.title}
        </h4>
        
        <div className="flex items-center gap-2 mt-1">
          {isProcessing && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
          {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          {isError && <AlertCircle className="w-3 h-3 text-red-400" />}
          
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            isDone ? "text-emerald-400" : isError ? "text-red-400" : "text-white/40"
          }`}>
            {isDone ? "Completed" : isError ? "Error" : `${task.status} ${task.progress}%`}
          </span>
        </div>

        {isDone && task.downloadUrl && (
          <a 
            href={task.downloadUrl}
            className="mt-2 text-[10px] text-purple-400 font-bold flex items-center gap-1 hover:text-purple-300 transition-colors"
          >
            Didn't start? Click here <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Remove Button */}
      <button 
        onClick={onRemove}
        className="absolute top-2 right-2 text-white/20 hover:text-white transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
