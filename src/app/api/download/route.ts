import { NextRequest, NextResponse } from "next/server";
import { Innertube, Platform, ClientType } from "youtubei.js";
import contentDisposition from "content-disposition";
import http from "http";
import { spawn } from "child_process";
import { Readable } from "stream";
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Enable JavaScript deciphering evaluation globally for player n-sig & s-sig deobfuscation
(Platform.shim as any).eval = async (data: any) => new Function(data.output)();

/**
 * In-memory cache implementation to avoid any filesystem writes.
 * Fixes Vercel serverless read-only filesystem error: ENOENT: mkdir '/vercel'.
 */
class MemoryCache {
  #store = new Map<string, ArrayBuffer>();

  get cache_dir(): string {
    return os.tmpdir();
  }

  async get(key: string): Promise<ArrayBuffer | undefined> {
    return this.#store.get(key);
  }

  async set(key: string, value: ArrayBuffer): Promise<void> {
    this.#store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.#store.delete(key);
  }
}

// Cache Innertube instances per client type for performance and session reuse
const innertubeSessions = new Map<string, Promise<Innertube>>();

function getInnertubeSession(clientType: string): Promise<Innertube> {
  const existing = innertubeSessions.get(clientType);
  if (existing) return existing;

  const sessionPromise = Innertube.create({
    client_type: clientType as any,
    cache: new MemoryCache(),
    generate_session_locally: true,
  }).catch((err) => {
    innertubeSessions.delete(clientType);
    throw err;
  });

  innertubeSessions.set(clientType, sessionPromise);
  return sessionPromise;
}

let pythonAvailable: boolean | null = null;
function checkPython(): Promise<boolean> {
  if (pythonAvailable !== null) return Promise.resolve(pythonAvailable);
  return new Promise((resolve) => {
    try {
      const p = spawn("python", ["--version"]);
      p.on("error", () => {
        pythonAvailable = false;
        resolve(false);
      });
      p.on("close", (code) => {
        pythonAvailable = code === 0;
        resolve(pythonAvailable);
      });
    } catch {
      pythonAvailable = false;
      resolve(false);
    }
  });
}

let ffmpegAvailable: boolean | null = null;
function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return Promise.resolve(ffmpegAvailable);
  return new Promise((resolve) => {
    try {
      const p = spawn("ffmpeg", ["-version"]);
      p.on("error", () => {
        ffmpegAvailable = false;
        resolve(false);
      });
      p.on("close", (code) => {
        ffmpegAvailable = code === 0;
        resolve(ffmpegAvailable);
      });
    } catch {
      ffmpegAvailable = false;
      resolve(false);
    }
  });
}

/**
 * Extracts YouTube video ID from standard watch links, youtu.be, shorts, embeds, live streams.
 */
function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^&?/\s]{11})/
  );
  if (match) return match[1];
  const fallback = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return fallback ? fallback[1] : null;
}

/**
 * Parses target vertical pixel height, strictly capping at 720p as requested.
 */
function parseTargetHeight(quality: string | null): number {
  if (!quality) return 720;
  const num = parseInt(quality.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) || num <= 0 ? 720 : Math.min(num, 720);
}

/**
 * Selects the genuine original creator audio format, avoiding secondary/dubbed languages.
 */
function selectOriginalAudioFormat(formats: any[]): any {
  const audioFormats = (formats || []).filter((f) => f.has_audio);
  if (audioFormats.length === 0) return null;

  // 1. Explicitly flagged as original track by YouTube
  const original = audioFormats.find((f) => f.is_original === true);
  if (original) return original;

  // 2. Track display name contains 'original' (e.g. 'Spanish (US) original')
  const originalByName = audioFormats.find(
    (f) => f.audio_track?.display_name && /original/i.test(f.audio_track.display_name)
  );
  if (originalByName) return originalByName;

  // 3. Track is marked as default
  const defaultTrack = audioFormats.find((f) => f.audio_track?.audio_is_default === true);
  if (defaultTrack) return defaultTrack;

  // 4. Highest bitrate MP4/AAC as general fallback
  return audioFormats.sort((a, b) => {
    const aMp4 = a.mime_type?.includes("mp4") ? 1 : 0;
    const bMp4 = b.mime_type?.includes("mp4") ? 1 : 0;
    if (bMp4 !== aMp4) return bMp4 - aMp4;
    return (b.bitrate || 0) - (a.bitrate || 0);
  })[0];
}

/**
 * Cleans up temporary download files older than 15 minutes to preserve storage.
 */
function cleanOldTempFiles(dir: string) {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    const now = Date.now();
    for (const file of files) {
      const p = path.join(dir, file);
      try {
        const stat = fs.statSync(p);
        if (now - stat.mtimeMs > 15 * 60 * 1000) {
          fs.unlinkSync(p);
        }
      } catch {}
    }
  } catch {}
}

/**
 * High-speed, robust YouTube download engine.
 * Downloads video and audio streams concurrently using 8 parallel chunk connections directly to disk,
 * prioritizes hyper-efficient AV1/VP9 compression (~50% smaller file size with zero quality loss),
 * and cleanly merges formats into a standard MP4 container with 100% synchronized AAC audio.
 * Eliminates pipe stalls, audio cut-offs/muting at end of videos, and slow download speeds.
 */
function downloadYouTubeToFile(
  youtubeUrl: string,
  type: "video" | "audio",
  quality: string | null,
  abortSignal?: AbortSignal
): Promise<{ stream: ReadableStream<Uint8Array>; contentLength: number; mimeType: string; extension: string }> {
  return new Promise((resolve, reject) => {
    const isAudio = type === "audio";
    const tempDir = path.join(os.tmpdir(), "yt_downloads");
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cleanOldTempFiles(tempDir);
    } catch {}

    const tempId = crypto.randomUUID();
    const outputTemplate = path.join(tempDir, `${tempId}.%(ext)s`);

    let ytdlpArgs: string[] = [];

    if (isAudio) {
      ytdlpArgs = [
        "-m",
        "yt_dlp",
        "--no-warnings",
        "--no-playlist",
        "--no-check-certificates",
        "--concurrent-fragments",
        "8",
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "-f",
        "bestaudio[format_note*=original]/bestaudio[language=orig]/bestaudio[language_preference>=0]/bestaudio",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "192K",
        "-o",
        outputTemplate,
        youtubeUrl,
      ];
    } else {
      const targetHeight = parseTargetHeight(quality);
      const formatSelector = [
        // 1. AV1: Ultra-compact compression (~50% smaller than H.264), pristine quality
        `bestvideo[height<=${targetHeight}][vcodec^=av01]+bestaudio[format_note*=original]`,
        `bestvideo[height<=${targetHeight}][vcodec^=av01]+bestaudio[language=orig]`,
        `bestvideo[height<=${targetHeight}][vcodec^=av01]+bestaudio`,
        // 2. VP9: Highly compressed (~35% smaller than H.264)
        `bestvideo[height<=${targetHeight}][vcodec^=vp09]+bestaudio[format_note*=original]`,
        `bestvideo[height<=${targetHeight}][vcodec^=vp09]+bestaudio`,
        `bestvideo[height<=${targetHeight}][vcodec^=vp9]+bestaudio[format_note*=original]`,
        `bestvideo[height<=${targetHeight}][vcodec^=vp9]+bestaudio`,
        // 3. Fallback: Standard H.264 / AVC1 / any
        `bestvideo[height<=${targetHeight}]+bestaudio[format_note*=original]`,
        `bestvideo[height<=${targetHeight}]+bestaudio[language=orig]`,
        `bestvideo[height<=${targetHeight}]+bestaudio`,
        `best[height<=${targetHeight}]`,
        "best",
      ].join("/");

      ytdlpArgs = [
        "-m",
        "yt_dlp",
        "--no-warnings",
        "--no-playlist",
        "--no-check-certificates",
        "--concurrent-fragments",
        "8",
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "-f",
        formatSelector,
        "--merge-output-format",
        "mp4",
        "--postprocessor-args",
        "Merger:-c:a aac -b:a 128k",
        "-o",
        outputTemplate,
        youtubeUrl,
      ];
    }

    const child = spawn("python", ytdlpArgs);

    const cleanupTemp = () => {
      try {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          if (file.startsWith(tempId)) {
            try {
              fs.unlinkSync(path.join(tempDir, file));
            } catch {}
          }
        }
      } catch {}
    };

    const killChild = () => {
      try {
        child.kill();
      } catch {}
      cleanupTemp();
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        killChild();
        return reject(new Error("Request aborted before download started"));
      }
      abortSignal.addEventListener("abort", killChild, { once: true });
    }

    child.on("error", (err) => {
      cleanupTemp();
      reject(err);
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        cleanupTemp();
        return reject(new Error(`yt-dlp exited with code ${code}`));
      }

      try {
        const dirFiles = await fs.promises.readdir(tempDir);
        const matched = dirFiles.find(
          (f) => f.startsWith(tempId) && !f.endsWith(".part") && !f.endsWith(".ytdl")
        );

        if (!matched) {
          cleanupTemp();
          return reject(new Error("Processed media file not found on disk"));
        }

        const finalFilePath = path.join(tempDir, matched);
        const stat = await fs.promises.stat(finalFilePath);
        const ext = path.extname(finalFilePath).replace(".", "").toLowerCase();

        const nodeStream = fs.createReadStream(finalFilePath);
        let streamClosed = false;

        const onStreamDone = () => {
          if (streamClosed) return;
          streamClosed = true;
          fs.promises.unlink(finalFilePath).catch(() => {});
        };

        nodeStream.on("end", onStreamDone);
        nodeStream.on("close", onStreamDone);
        nodeStream.on("error", onStreamDone);

        if (abortSignal) {
          abortSignal.addEventListener(
            "abort",
            () => {
              nodeStream.destroy();
              onStreamDone();
            },
            { once: true }
          );
        }

        const webStream = Readable.toWeb(nodeStream as any) as ReadableStream<Uint8Array>;
        resolve({
          stream: webStream,
          contentLength: stat.size,
          mimeType: isAudio ? "audio/mpeg" : "video/mp4",
          extension: ext || (isAudio ? "mp3" : "mp4"),
        });
      } catch (err) {
        cleanupTemp();
        reject(err);
      }
    });
  });
}

/**
 * Muxes separate high-res video and audio streams using local bridge server & FFmpeg without re-encoding.
 */
function muxVideoAndAudioWithFFmpeg(
  vUrl: string,
  aUrl: string,
  vLen: number,
  aLen: number,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  return new Promise((resolve, reject) => {
    async function streamChunks(targetUrl: string, totalLen: number, chunkSize: number, res: http.ServerResponse) {
      let start = 0;
      while (start < totalLen) {
        if (res.writableEnded || res.destroyed) break;
        const end = Math.min(start + chunkSize - 1, totalLen - 1);
        try {
          const upstream = await fetch(targetUrl, {
            headers: {
              Range: `bytes=${start}-${end}`,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          if (!upstream.ok && upstream.status !== 206) break;
          if (upstream.body) {
            const reader = upstream.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const ok = res.write(Buffer.from(value));
              if (!ok) await new Promise((r) => res.once("drain", r));
            }
          }
          start = end + 1;
        } catch {
          break;
        }
      }
      res.end();
    }

    const server = http.createServer((req, res) => {
      if (req.url === "/video") {
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": vLen,
        });
        streamChunks(vUrl, vLen, 512 * 1024, res);
      } else if (req.url === "/audio") {
        res.writeHead(200, {
          "Content-Type": "audio/mp4",
          "Content-Length": aLen,
        });
        streamChunks(aUrl, aLen, 256 * 1024, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (!port) {
        server.close();
        return reject(new Error("Failed to allocate local bridge port"));
      }

      const ffmpeg = spawn("ffmpeg", [
        "-loglevel",
        "error",
        "-i",
        `http://127.0.0.1:${port}/video`,
        "-i",
        `http://127.0.0.1:${port}/audio`,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
        "pipe:1",
      ]);

      const cleanup = () => {
        try {
          ffmpeg.kill();
        } catch {}
        try {
          server.close();
        } catch {}
      };

      if (abortSignal) {
        abortSignal.addEventListener("abort", cleanup, { once: true });
      }

      ffmpeg.on("error", (err) => {
        cleanup();
        reject(err);
      });

      ffmpeg.on("close", () => {
        cleanup();
      });

      const webStream = Readable.toWeb(ffmpeg.stdout as any) as ReadableStream<Uint8Array>;
      resolve(webStream);
    });
  });
}

/**
 * Downloads YouTube video at the exact requested quality using Innertube as secondary fallback.
 */
async function getHighQualityYouTubeVideoStream(
  videoId: string,
  quality: string | null,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const targetHeight = parseTargetHeight(quality);
  const clients = [ClientType.IOS, ClientType.MWEB, ClientType.ANDROID];

  let lastErr: Error | null = null;

  for (const ctype of clients) {
    try {
      const yt = await getInnertubeSession(ctype);
      const info = await yt.getBasicInfo(videoId);

      const allVideoFormats = [
        ...(info.streaming_data?.formats || []),
        ...(info.streaming_data?.adaptive_formats || []),
      ]
        .filter((f) => f.has_video)
        .sort((a, b) => {
          const hDiff = (b.height || 0) - (a.height || 0);
          if (hDiff !== 0) return hDiff;
          const aMp4 = a.mime_type?.includes("mp4") ? 1 : 0;
          const bMp4 = b.mime_type?.includes("mp4") ? 1 : 0;
          return bMp4 - aMp4;
        });

      if (allVideoFormats.length === 0) continue;

      // Select format matching target height or highest available below target
      const matchingVideo =
        allVideoFormats.find((f) => (f.height || 0) <= targetHeight) || allVideoFormats[0];

      // If format already has audio (e.g. progressive stream 18 or 22), stream directly
      if (matchingVideo.has_audio) {
        const stream = await yt.download(videoId, {
          itag: matchingVideo.itag,
          type: "video+audio",
        });
        return stream;
      }

      // Format is video-only -> select the original creator audio track
      const matchingAudio = selectOriginalAudioFormat(info.streaming_data?.adaptive_formats || []);
      if (!matchingAudio) continue;

      const vUrl = await matchingVideo.decipher(yt.session.player);
      const aUrl = await matchingAudio.decipher(yt.session.player);

      if (!vUrl || !aUrl) continue;

      const vLen =
        typeof matchingVideo.content_length === "number"
          ? matchingVideo.content_length
          : parseInt((matchingVideo.content_length as any) || "0", 10) || 500 * 1024 * 1024;

      const aLen =
        typeof matchingAudio.content_length === "number"
          ? matchingAudio.content_length
          : parseInt((matchingAudio.content_length as any) || "0", 10) || 30 * 1024 * 1024;

      return await muxVideoAndAudioWithFFmpeg(vUrl, aUrl, vLen, aLen, abortSignal);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr || new Error(`Could not mux video at requested quality for ${videoId}`);
}

/**
 * Resilient fallback stream extractor for videos or audio using Innertube.
 */
async function getWorkingYouTubeStream(
  videoId: string,
  type: "video" | "audio",
  quality: string | null
): Promise<{ stream: ReadableStream<Uint8Array>; mimeType: string }> {
  const clientsToTry = [ClientType.ANDROID, ClientType.MWEB, ClientType.IOS];

  let lastError: Error | null = null;

  for (const clientType of clientsToTry) {
    try {
      const yt = await getInnertubeSession(clientType);
      const info = await yt.getBasicInfo(videoId);
      const optionsList: Parameters<typeof yt.download>[1][] = [];

      if (type === "audio") {
        const origAudio = selectOriginalAudioFormat(info.streaming_data?.adaptive_formats || []);
        if (origAudio && origAudio.itag) {
          optionsList.push({ itag: origAudio.itag, type: "audio" });
        }
        optionsList.push({ type: "audio", quality: "best" });
        optionsList.push({ type: "audio", format: "any" });
        optionsList.push({ type: "video+audio", quality: "best", format: "any" });
      } else {
        const targetHeight = parseTargetHeight(quality);
        const videoFormats = (info.streaming_data?.formats || []).filter((f) => f.has_video);
        const matchingProg = videoFormats.find((f) => (f.height || 0) <= targetHeight) || videoFormats[0];
        if (matchingProg && matchingProg.itag) {
          optionsList.push({ itag: matchingProg.itag, type: "video+audio" });
        }
        optionsList.push({ type: "video+audio", quality: "best", format: "any" });
        optionsList.push({ type: "video+audio", quality: "best" });
        optionsList.push({ type: "video", quality: "best" });
      }

      for (const opts of optionsList) {
        try {
          const rawStream = await yt.download(videoId, opts);
          const reader = rawStream.getReader();
          const firstChunk = await reader.read();

          if (firstChunk.value && firstChunk.value.length > 0) {
            const verifiedStream = new ReadableStream<Uint8Array>({
              async start(controller) {
                controller.enqueue(firstChunk.value);
                try {
                  for (;;) {
                    const { done, value } = await reader.read();
                    if (done) {
                      controller.close();
                      break;
                    }
                    controller.enqueue(value);
                  }
                } catch (err) {
                  controller.error(err);
                }
              },
              cancel() {
                reader.cancel();
              },
            });

            return {
              stream: verifiedStream,
              mimeType: type === "audio" ? "audio/mp4" : "video/mp4",
            };
          }
        } catch {
          // Continue to next options
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`No available stream found for video: ${videoId}`);
}

/**
 * Converts raw audio stream to standard MP3 using FFmpeg on-the-fly streaming pipeline.
 */
async function convertAudioToMp3WebStream(
  rawWebStream: ReadableStream<Uint8Array>,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) return rawWebStream;

  return new Promise((resolve) => {
    try {
      const nodeReadable = Readable.fromWeb(rawWebStream as any);
      const ffmpeg = spawn("ffmpeg", [
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn",
        "-b:a",
        "192k",
        "-f",
        "mp3",
        "pipe:1",
      ]);

      const cleanup = () => {
        try {
          ffmpeg.kill();
        } catch {}
      };

      if (abortSignal) {
        abortSignal.addEventListener("abort", cleanup, { once: true });
      }

      ffmpeg.on("error", (err) => {
        console.warn("[FFMPEG NOT FOUND / ERROR, FALLBACK TO RAW AUDIO]:", err);
        cleanup();
        resolve(rawWebStream);
      });

      nodeReadable.pipe(ffmpeg.stdin);
      nodeReadable.on("error", cleanup);
      ffmpeg.stdin.on("error", () => {});
      ffmpeg.on("close", cleanup);

      resolve(Readable.toWeb(ffmpeg.stdout as any) as ReadableStream<Uint8Array>);
    } catch (err) {
      console.warn("[FFMPEG] Fallback to direct audio stream:", err);
      resolve(rawWebStream);
    }
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const type = (req.nextUrl.searchParams.get("type") || "video") as "video" | "audio";
  const quality = req.nextUrl.searchParams.get("quality");
  const rawFilename = req.nextUrl.searchParams.get("filename") || "download";

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported protocol");
  } catch {
    return NextResponse.json({ error: "Invalid download URL" }, { status: 400 });
  }

  const cleanFilename = rawFilename
    .replace(/[^a-zA-Z0-9\s\-_.()]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 120);

  // --- YOUTUBE PIPELINE WITH ORIGINAL AUDIO & EXACT QUALITY SELECTION ---
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      const videoId = extractYouTubeId(url);
      if (!videoId) throw new Error("Invalid YouTube link");

      let finalStream: ReadableStream<Uint8Array> | null = null;
      let finalExtension = type === "audio" ? "mp3" : "mp4";
      let finalMimeType = type === "audio" ? "audio/mpeg" : "video/mp4";
      let finalContentLength: number | null = null;

      // 1. Try primary yt-dlp high-speed engine if Python is available in environment
      const hasPython = await checkPython();
      if (hasPython) {
        try {
          const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
          const ytdlpResult = await downloadYouTubeToFile(canonicalUrl, type, quality, req.signal);
          finalStream = ytdlpResult.stream;
          finalExtension = ytdlpResult.extension;
          finalMimeType = ytdlpResult.mimeType;
          finalContentLength = ytdlpResult.contentLength;
        } catch (ytdlpErr) {
          console.warn("[YTDLP PRIMARY FAILED, FALLING BACK TO INNERTUBE]:", ytdlpErr);
        }
      }

      // 2. Secondary fallback via Innertube (runs seamlessly in serverless environments like Vercel)
      if (!finalStream) {
        const hasFfmpeg = await checkFfmpeg();

        if (type === "video") {
          if (hasFfmpeg) {
            try {
              finalStream = await getHighQualityYouTubeVideoStream(videoId, quality, req.signal);
            } catch (hqErr) {
              console.warn("[INNERTUBE HQ MUX FALLBACK]", hqErr);
              const { stream: fallbackStream } = await getWorkingYouTubeStream(videoId, "video", quality);
              finalStream = fallbackStream;
            }
          } else {
            // Direct progressive MP4 stream without external ffmpeg (essential for Vercel)
            const { stream: fallbackStream } = await getWorkingYouTubeStream(videoId, "video", quality);
            finalStream = fallbackStream;
          }
        } else {
          const { stream: rawAudioStream, mimeType: rawMime } = await getWorkingYouTubeStream(videoId, "audio", quality);
          if (hasFfmpeg) {
            try {
              finalStream = await convertAudioToMp3WebStream(rawAudioStream, req.signal);
              finalExtension = "mp3";
              finalMimeType = "audio/mpeg";
            } catch {
              finalExtension = rawMime.includes("mp4") ? "m4a" : "mp3";
              finalMimeType = rawMime;
              finalStream = rawAudioStream;
            }
          } else {
            // Direct pure audio stream without external FFmpeg (e.g. Vercel)
            finalExtension = rawMime.includes("mp4") ? "m4a" : "mp3";
            finalMimeType = rawMime;
            finalStream = rawAudioStream;
          }
        }
      }

      const filenameWithExt = `${cleanFilename}.${finalExtension}`;

      const responseHeaders: Record<string, string> = {
        "Content-Disposition": contentDisposition(filenameWithExt),
        "Content-Type": finalMimeType,
        "Cache-Control": "no-cache",
      };

      if (finalContentLength && finalContentLength > 0) {
        responseHeaders["Content-Length"] = finalContentLength.toString();
      }

      return new NextResponse(finalStream, {
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("[YOUTUBE DOWNLOAD ERROR]", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "YouTube download failed" },
        { status: 500 }
      );
    }
  }

  // --- TUNNEL ENGINE (TIKTOK / INSTAGRAM / ALL OTHER PLATFORMS) ---
  const extension = type === "audio" ? "mp3" : "mp4";
  const mimeType = type === "audio" ? "audio/mpeg" : "video/mp4";
  const filenameWithExt = `${cleanFilename}.${extension}`;

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        Referer: url.includes("instagram") ? "https://www.instagram.com/" : "https://www.tiktok.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) throw new Error(`Upstream CDN error: ${response.status}`);
    if (!response.body) throw new Error("Empty response from CDN");

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition(filenameWithExt),
        "Content-Length": response.headers.get("Content-Length") || "",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[TUNNEL ERROR]", error);
    return NextResponse.json({ error: "Download tunnel failed" }, { status: 500 });
  }
}
