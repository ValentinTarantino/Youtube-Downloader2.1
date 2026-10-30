import { NextRequest, NextResponse } from "next/server";
import { Innertube, Platform, ClientType } from "youtubei.js";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import contentDisposition from "content-disposition";

import { spawn } from "child_process";
import { Readable, PassThrough, pipeline } from "stream";
import { pipeline as pipelineAsync } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, rm, stat } from "fs/promises";
import { join } from "path";
import os from "os";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import { firstFormatUrl } from "@/lib/format-url";
import { runInNewContext } from "node:vm";
import { downloadYouTubeVideo } from "@/lib/youtube-video";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getFfmpegBinary(): string {
  if (process.env.FFMPEG_BINARY) return process.env.FFMPEG_BINARY;
  if (ffmpegPath && typeof ffmpegPath === "string" && fs.existsSync(ffmpegPath)) {
    try {
      fs.chmodSync(ffmpegPath, 0o755);
    } catch {}
    return ffmpegPath;
  }
  return "ffmpeg";
}

let ffmpegAvailable: boolean | null = null;
function checkFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null) return Promise.resolve(ffmpegAvailable);
  const bin = getFfmpegBinary();
  return new Promise((resolve) => {
    try {
      const p = spawn(bin, ["-version"]);
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

// Global JavaScript deciphering evaluator for player n-sig & s-sig deobfuscation
(Platform.shim as any).eval = async (data: any, env: any = {}) => {
  return runInNewContext(`(function(){${data.output}\n})()`, { ...env }, { timeout: 5000 });
};

// Safe proxy agent (only used if explicitly provided via environment)
function getOptionalProxyAgent(): ProxyAgent | undefined {
  const raw = (process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "").trim();
  if (!raw || raw === "undefined" || raw === "null" || raw.includes("__Secure-")) {
    return undefined;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return new ProxyAgent(raw);
    }
  } catch {}
  return undefined;
}

const optionalProxyAgent = getOptionalProxyAgent();

const customFetch: typeof fetch = (input: any, init?: any) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input && typeof input === "object" && "url" in input
      ? input.url
      : String(input);

  if (optionalProxyAgent) {
    const method = (init?.method || (input && input.method) || "GET").toUpperCase();
    const headers = init?.headers || (input && input.headers ? input.headers : undefined);
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : init?.body ?? (input && input.body ? input.body : undefined);

    return undiciFetch(url, {
      ...init,
      method,
      headers,
      body,
      dispatcher: optionalProxyAgent,
    }) as any;
  }
  return fetch(input, init);
};

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

// Cached Innertube sessions per client type
const innertubeSessions = new Map<string, Promise<Innertube>>();

function getInnertubeSession(clientType: string): Promise<Innertube> {
  const existing = innertubeSessions.get(clientType);
  if (existing) return existing;

  const sessionPromise = Innertube.create({
    client_type: clientType as any,
    cache: new MemoryCache(),
    generate_session_locally: true,
    fetch: optionalProxyAgent ? customFetch : undefined,
  }).catch((err) => {
    innertubeSessions.delete(clientType);
    throw err;
  });

  innertubeSessions.set(clientType, sessionPromise);
  return sessionPromise;
}

// In-memory cache for resolved video info with 10-minute TTL
interface CachedInfo {
  data: any;
  clientType: string;
  yt: Innertube;
  expiresAt: number;
  media?: { video: string; audio: string };
}
const infoCache = new Map<string, CachedInfo>();

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^&?/\s]{11})/
  );
  if (match) return match[1];
  const fallback = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return fallback ? fallback[1] : null;
}

function parseTargetHeight(quality: string | null): number {
  if (!quality) return 720;
  const num = parseInt(quality.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) || num <= 0 ? 720 : Math.min(num, 1080);
}

// 2026 Client Hierarchy ordered by probability of success without PO tokens or cookies
const CLIENT_LADDER = [
  ClientType.ANDROID,       // Primary: guaranteed unthrottled progressive MP4 (itag 18) with video + AAC audio
  ClientType.IOS,           // High quality adaptive streams
  ClientType.ANDROID_VR,    // VR client
  ClientType.MWEB,          // Mobile web persona
];

async function resolveVideoInfo(videoId: string, targetHeight?: number): Promise<{ info: any; clientType: string; yt: Innertube; media?: { video: string; audio: string } }> {
  const cacheKey = `${videoId}:${targetHeight ?? "audio"}`;
  const cached = infoCache.get(cacheKey);
  if (targetHeight === undefined && cached && cached.expiresAt > Date.now()) {
    return { info: cached.data, clientType: cached.clientType, yt: cached.yt };
  }

  const errors: string[] = [];
  for (const client of CLIENT_LADDER) {
    try {
      const yt = await getInnertubeSession(client);
      const info = await yt.getBasicInfo(videoId);
      const status = (info as any).playability_status?.status;

      if (status === "OK" && info.streaming_data) {
        const hasUsable = [
          ...(info.streaming_data.formats || []),
          ...(info.streaming_data.adaptive_formats || []),
        ].some((f: any) => f.url || f.signature_cipher || f.cipher);

        if (hasUsable) {
          let media: { video: string; audio: string } | undefined;
          if (targetHeight !== undefined) {
            const formats = [
              ...(info.streaming_data.formats || []),
              ...(info.streaming_data.adaptive_formats || []),
            ];
            const decipher = (format: any): Promise<string> => format.decipher(yt.session.player);
            const usable = async (url: string) => {
              const response = await customFetch(url, { signal: AbortSignal.timeout(15000) });
              const ok = response.ok && Boolean(response.body);
              await response.body?.cancel();
              if (!ok) errors.push(`${client}: CDN HTTP ${response.status}`);
              return ok;
            };
            const videoUrl = await firstFormatUrl(
              formats.filter((f: any) => f.has_video && f.height === targetHeight), decipher, usable,
            );
            const audioUrl = await firstFormatUrl(
              formats.filter((f: any) => f.has_audio), decipher, usable,
            );
            if (!videoUrl || !audioUrl) {
              const heights = [...new Set(formats
                .filter((f: any) => f.has_video && (f.url || f.cipher || f.signature_cipher))
                .map((f: any) => f.height))].join(",");
              errors.push(`${client}: requested=${targetHeight}p, listed heights=[${heights}], video=${Boolean(videoUrl)}, audio=${Boolean(audioUrl)}`);
              continue;
            }
            media = { video: videoUrl, audio: audioUrl };
          }
          const entry: CachedInfo = {
            data: info,
            clientType: client,
            yt,
            expiresAt: Date.now() + 10 * 60 * 1000,
            media,
          };
          infoCache.set(cacheKey, entry);
          return { info, clientType: client, yt, media };
        }
      }
      errors.push(`${client}:${status}`);
    } catch (err: any) {
      errors.push(`${client}:${err.message || "error"}`);
    }
  }

  throw new Error(`YouTube stream unavailable for ${videoId}. Diagnostics: [${errors.join(" | ")}]`);
}

// ---------------------------------------------------------------------------
// VIDEO ENGINE
// yt-dlp is used when the binary is available (local dev). On hosts where it
// is not shipped (e.g. Vercel) we extract the streams with Innertube instead
// and mux them with the bundled ffmpeg binary.
// ---------------------------------------------------------------------------
function resolveYtDlpBinary(): string {
  if (process.env.YTDLP_BINARY) return process.env.YTDLP_BINARY;
  return process.platform === "win32"
    ? join(process.cwd(), ".tools", "yt-dlp.exe")
    : "yt-dlp";
}

let ytdlpAvailable: boolean | null = null;
function checkYtDlp(): Promise<boolean> {
  if (ytdlpAvailable !== null) return Promise.resolve(ytdlpAvailable);
  const binary = resolveYtDlpBinary();
  const cached = (value: boolean) => {
    ytdlpAvailable = value;
    return value;
  };
  return new Promise((resolve) => {
    try {
      const p = spawn(binary, ["--version"]);
      p.on("error", () => resolve(cached(false)));
      p.on("close", (code) => resolve(cached(code === 0)));
    } catch {
      resolve(cached(false));
    }
  });
}

/** Chooses the available height closest to the requested one (never upscales). */
function pickHeight(heights: number[], target: number): number | undefined {
  const unique = [...new Set(heights)].filter((h) => Number.isFinite(h) && h > 0);
  if (!unique.length) return undefined;
  if (unique.includes(target)) return target;
  const below = unique.filter((h) => h < target).sort((a, b) => b - a)[0];
  if (below) return below;
  return [...unique].sort((a, b) => a - b)[0];
}

type VideoSource =
  | { kind: "muxed"; url: string; height: number }
  | { kind: "split"; videoUrl: string; audioUrl: string; height: number };

/** A resolved URL is only useful if the CDN actually serves bytes for it. */
async function isPlayable(url: string, signal?: AbortSignal): Promise<boolean> {
  let timeout: AbortSignal;
  try {
    timeout = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  } catch {
    timeout = AbortSignal.timeout(15000);
  }
  try {
    const response = await customFetch(url, {
      headers: { Range: "bytes=0-0" },
      signal: timeout,
    });
    const ok = response.status === 206 || response.ok;
    await response.body?.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

async function loadVideoFormats(videoId: string, client: string) {
  const yt = await getInnertubeSession(client);
  const info = await yt.getBasicInfo(videoId);
  const status = (info as any).playability_status?.status;
  if (status !== "OK" || !info.streaming_data) throw new Error(String(status));
  return {
    yt,
    formats: [
      ...(info.streaming_data.formats || []),
      ...(info.streaming_data.adaptive_formats || []),
    ] as any[],
  };
}

function bestAudio(formats: any[]): any | undefined {
  return formats
    .filter((f) => f.has_audio && !f.has_video)
    .sort((a, b) => {
      const aM4a = /mp4|m4a/.test(String(a.mime_type || "")) ? 1 : 0;
      const bM4a = /mp4|m4a/.test(String(b.mime_type || "")) ? 1 : 0;
      if (aM4a !== bM4a) return bM4a - aM4a;
      return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
    })[0];
}

async function resolveVideoSource(
  videoId: string,
  targetHeight: number,
  signal?: AbortSignal
): Promise<VideoSource> {
  const errors: string[] = [];

  // Pass 1: best matching quality (adaptive when needed).
  for (const client of CLIENT_LADDER) {
    try {
      const { yt, formats } = await loadVideoFormats(videoId, client);
      const decipher = (format: any): Promise<string> => format.decipher(yt.session.player);

      const height = pickHeight(
        formats.filter((f) => f.has_video && f.height).map((f) => Number(f.height)),
        targetHeight
      );
      if (!height) {
        errors.push(`${client}: no video heights`);
        continue;
      }

      // Prefer a single progressive stream: no muxing, fastest response.
      const muxed = formats.find((f) => f.has_video && f.has_audio && f.height === height);
      if (muxed) {
        const url = muxed.url || (await decipher(muxed));
        if (url && (await isPlayable(url, signal))) return { kind: "muxed", url, height };
        if (url) errors.push(`${client}: muxed ${height}p rejected by CDN`);
      }

      const video = formats.find((f) => f.has_video && !f.has_audio && f.height === height);
      const audio = bestAudio(formats);
      if (video && audio) {
        const [videoUrl, audioUrl] = await Promise.all([
          video.url || decipher(video),
          audio.url || decipher(audio),
        ]);
        if (
          videoUrl &&
          audioUrl &&
          (await Promise.all([isPlayable(videoUrl, signal), isPlayable(audioUrl, signal)])).every(Boolean)
        ) {
          return { kind: "split", videoUrl, audioUrl, height };
        }
        if (videoUrl && audioUrl) errors.push(`${client}: ${height}p rejected by CDN`);
      }

      errors.push(`${client}: incomplete formats at ${height}p`);
    } catch (err: any) {
      errors.push(`${client}:${err.message || "error"}`);
    }
  }

  // Pass 2: progressive-only fallback (e.g. 360p) for videos whose adaptive
  // streams require a PO token.
  for (const client of CLIENT_LADDER) {
    try {
      const { yt, formats } = await loadVideoFormats(videoId, client);
      const muxed = formats.filter((f) => f.has_video && f.has_audio && f.height);
      const height = pickHeight(muxed.map((f) => Number(f.height)), targetHeight);
      if (!height) continue;
      const chosen = muxed.find((f) => f.height === height);
      if (!chosen) continue;
      const url = chosen.url || (await chosen.decipher(yt.session.player));
      if (url && (await isPlayable(url, signal))) return { kind: "muxed", url, height };
      errors.push(`${client}: progressive ${height}p rejected by CDN`);
    } catch (err: any) {
      errors.push(`${client}:${err.message || "error"}`);
    }
  }

  throw new Error(`No downloadable video stream. [${errors.join(" | ")}]`);
}

const RANGE_PARTS = 6;
const RANGE_MIN_BYTES = 3 * 1024 * 1024;
const RANGE_CHUNK_BYTES = 8 * 1024 * 1024;

async function fetchRangeToFile(
  url: string,
  start: number,
  end: number,
  destination: string,
  signal?: AbortSignal
): Promise<void> {
  const response = await customFetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Media CDN range returned HTTP ${response.status}`);
  }
  await pipelineAsync(Readable.fromWeb(response.body as any), createWriteStream(destination));
}

async function* concatenate(parts: string[]): AsyncGenerator<Buffer> {
  for (const part of parts) {
    for await (const chunk of createReadStream(part)) yield chunk as Buffer;
    await rm(part, { force: true });
  }
}

/**
 * YouTube throttles a single connection hard for unsigned CDN links, so large
 * files are fetched as parallel byte ranges and then concatenated.
 */
async function downloadToFile(url: string, destination: string, signal?: AbortSignal): Promise<void> {
  const probe = await customFetch(url, { headers: { Range: "bytes=0-0" }, signal });
  const contentRange = probe.headers.get("content-range");
  const total = Number(contentRange?.split("/")[1]) || 0;
  await probe.body?.cancel().catch(() => {});

  if (probe.status !== 206 || !total || total < RANGE_MIN_BYTES) {
    const response = await customFetch(url, { signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Media CDN returned HTTP ${response.status}`);
    }
    await pipelineAsync(Readable.fromWeb(response.body as any), createWriteStream(destination));
    return;
  }

  const parts = Math.min(RANGE_PARTS, Math.max(2, Math.ceil(total / RANGE_CHUNK_BYTES)));
  const size = Math.ceil(total / parts);
  const files: string[] = [];

  await Promise.all(
    Array.from({ length: parts }, (_, i) => {
      const start = i * size;
      const end = Math.min(total - 1, start + size - 1);
      const file = `${destination}.part${i}`;
      files[i] = file;
      return fetchRangeToFile(url, start, end, file, signal);
    })
  );

  await pipelineAsync(Readable.from(concatenate(files)), createWriteStream(destination));
}

function runFfmpeg(binary: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { signal });
    let diagnostic = "";
    const collect = (chunk: Buffer) => {
      diagnostic = (diagnostic + chunk).slice(-8000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${diagnostic}`))
    );
  });
}

/** Downloads both adaptive streams and merges them into a single MP4. */
async function muxToResponse(
  videoUrl: string,
  audioUrl: string,
  height: number,
  signal?: AbortSignal
): Promise<{ body: ReadableStream<Uint8Array>; size: number; height: number }> {
  const directory = await mkdtemp(join(os.tmpdir(), "clipdrop-mux-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  const videoFile = join(directory, "video.mp4");
  const audioFile = join(directory, "audio.m4a");
  const outputFile = join(directory, "output.mp4");

  try {
    await Promise.all([
      downloadToFile(videoUrl, videoFile, signal),
      downloadToFile(audioUrl, audioFile, signal),
    ]);
    await runFfmpeg(
      getFfmpegBinary(),
      [
        "-nostdin", "-y", "-v", "error",
        "-i", videoFile,
        "-i", audioFile,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy", "-movflags", "+faststart",
        outputFile,
      ],
      signal
    );

    const size = (await stat(outputFile)).size;
    if (!size) throw new Error("Merged video is empty");

    const stream = createReadStream(outputFile);
    const abort = () => stream.destroy(new Error("Download aborted"));
    stream.once("close", () => {
      signal?.removeEventListener("abort", abort);
      void cleanup().catch(console.error);
    });
    stream.once("error", () => void cleanup().catch(console.error));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    return {
      body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      size,
      height,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function proxyMuxedResponse(url: string, height: number, filename: string, signal?: AbortSignal) {
  const upstream = await customFetch(url, { signal });
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    throw new Error(`Media CDN returned HTTP ${upstream.status}`);
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": contentDisposition(`${filename}.mp4`),
      "Content-Length": upstream.headers.get("content-length") || "",
      "X-Video-Height": String(height),
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Downloads through the shared transport and converts the input to MP3.
 */
async function extractAudioWithFFmpeg(
  streamUrl: string,
  abortSignal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const upstream = await customFetch(streamUrl, { signal: abortSignal });
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    throw new Error(`Audio CDN download failed: HTTP ${upstream.status}`);
  }
  const input = Readable.fromWeb(upstream.body as any);
  const output = new PassThrough();
  const bin = getFfmpegBinary();
  const ffmpeg = spawn(bin, [
    "-loglevel", "error",
    "-i", "pipe:0",
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-f", "mp3",
    "pipe:1",
  ]);

  const abort = () => output.destroy(new Error("Audio download aborted"));
  output.on("close", () => {
    input.destroy();
    ffmpeg.kill();
    abortSignal?.removeEventListener("abort", abort);
  });
  ffmpeg.stderr.resume();
  ffmpeg.on("error", (error) => output.destroy(error));
  ffmpeg.stdout.on("error", (error) => output.destroy(error));
  ffmpeg.stdout.pipe(output, { end: false });
  pipeline(input, ffmpeg.stdin, (error) => {
    if (error) output.destroy(error);
  });
  ffmpeg.on("close", (code) => {
    if (code === 0) output.end();
    else output.destroy(new Error(`MP3 conversion failed: FFmpeg exit ${code}`));
  });
  const result = Readable.toWeb(output) as ReadableStream<Uint8Array>;
  abortSignal?.addEventListener("abort", abort, { once: true });
  if (abortSignal?.aborted) abort();
  return result;
}

export async function GET(req: NextRequest) {
  if (process.env.DOWNLOAD_BACKEND_MODE === "true") {
    const expected = process.env.DOWNLOAD_BACKEND_TOKEN;
    if (!expected) return NextResponse.json({ error: "Backend authentication is not configured" }, { status: 503 });
    const actual = Buffer.from(req.headers.get("authorization") || "");
    const required = Buffer.from(`Bearer ${expected}`);
    if (actual.length !== required.length || !timingSafeEqual(actual, required)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
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
  if (process.env.DOWNLOAD_BACKEND_MODE === "true") {
    const host = parsedUrl.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
      return NextResponse.json({ error: "This backend accepts YouTube URLs only" }, { status: 400 });
    }
  }
  if (!["video", "audio"].includes(type)) return NextResponse.json({ error: "Invalid download type" }, { status: 400 });

  const cleanFilename = rawFilename
    .replace(/[^a-zA-Z0-9\s\-_.()]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 120);

  // --- YOUTUBE PIPELINE (2026 ARCHITECTURE) ---
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      const videoId = extractYouTubeId(url);
      if (!videoId) throw new Error("Invalid YouTube link");

      if (type === "video") {
        const targetHeight = parseTargetHeight(quality);
        const engine = (req.nextUrl.searchParams.get("engine") || "auto").toLowerCase();
        // A probe only validates that a playable stream exists (no bytes are downloaded).
        const probe = req.method === "HEAD" || req.nextUrl.searchParams.get("probe") === "1";

        let ytdlpFailed = false;
        if (engine !== "innertube" && (engine === "ytdlp" || (await checkYtDlp()))) {
          try {
            const result = await downloadYouTubeVideo(videoId, targetHeight, getFfmpegBinary(), req.signal);
            if (probe) {
              await result.body.cancel().catch(() => {});
              return new NextResponse(null, {
                status: 200,
                headers: {
                  "Content-Type": "video/mp4",
                  "Content-Length": String(result.size),
                  "X-Video-Height": String(result.height),
                  "Cache-Control": "no-store",
                },
              });
            }
            return new NextResponse(result.body, {
              headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": contentDisposition(`${cleanFilename}.mp4`),
                "Content-Length": String(result.size),
                "X-Video-Height": String(result.height),
                "Cache-Control": "no-store",
              },
            });
          } catch (error) {
            ytdlpFailed = true;
            console.warn("[YT-DLP UNAVAILABLE, USING INNERTUBE]", error);
            if (engine === "ytdlp") throw error;
          }
        }

        const source = await resolveVideoSource(videoId, targetHeight, req.signal);
        if (probe) {
          return new NextResponse(null, {
            status: 200,
            headers: {
              "Content-Type": "video/mp4",
              "X-Video-Height": String(source.height),
              "X-Video-Engine": ytdlpFailed ? "innertube" : "auto",
              "Cache-Control": "no-store",
            },
          });
        }
        if (source.kind === "muxed") {
          return await proxyMuxedResponse(source.url, source.height, cleanFilename, req.signal);
        }
        const merged = await muxToResponse(source.videoUrl, source.audioUrl, source.height, req.signal);
        return new NextResponse(merged.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": contentDisposition(`${cleanFilename}.mp4`),
            "Content-Length": String(merged.size),
            "X-Video-Height": String(merged.height),
            "Cache-Control": "no-store",
          },
        });
      }

      const { info, yt } = await resolveVideoInfo(
        videoId,
      );
      const streamingData = info.streaming_data;
      const progFormats: any[] = streamingData?.formats || [];
      const adaptiveFormats: any[] = streamingData?.adaptive_formats || [];

      // --- AUDIO DOWNLOAD (FAST, ROBUST, 0-500 ERROR) ---
      if (type === "audio") {
        // Priority 1: Unthrottled progressive itag 18 stream
        let audioSourceUrl: string | undefined;

        const prog = progFormats.find((f) => f.has_audio && f.url) || progFormats[0];
        if (prog?.url) {
          audioSourceUrl = prog.url;
        }

        // Priority 2: Adaptive audio formats (itag 140 / 251)
        if (!audioSourceUrl) {
          const audioCandidates = adaptiveFormats
            .filter((f) => f.has_audio && !f.has_video)
            .sort((a, b) => {
              const a140 = a.itag === 140 ? 1 : 0;
              const b140 = b.itag === 140 ? 1 : 0;
              if (b140 !== a140) return b140 - a140;
              return (b.bitrate || 0) - (a.bitrate || 0);
            });

          const target = audioCandidates.find((f) => f.url) || audioCandidates[0];
          if (target) {
            audioSourceUrl = target.url || (await target.decipher(yt.session.player));
          }
        }

        if (!audioSourceUrl) {
          throw new Error("No usable audio format found");
        }

        if (req.method === "HEAD" || req.nextUrl.searchParams.get("probe") === "1") {
          return new NextResponse(null, {
            status: 200,
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        }

        const hasFfmpeg = await checkFfmpeg();
        if (hasFfmpeg) {
            const mp3Stream = await extractAudioWithFFmpeg(audioSourceUrl, req.signal);
            return new NextResponse(mp3Stream, {
              headers: {
                "Content-Disposition": contentDisposition(`${cleanFilename}.mp3`),
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-cache",
              },
            });
        }
        throw new Error("MP3 conversion requires FFmpeg on the download server");
      }

      throw new Error("Unsupported download type");
    } catch (error) {
      console.error("[YOUTUBE DOWNLOAD ERROR]", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "YouTube download failed" },
        { status: 500 }
      );
    }
  }

  // --- TUNNEL ENGINE (TIKTOK / INSTAGRAM / ALL OTHER CDN PLATFORMS) ---
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
      signal: req.signal,
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
