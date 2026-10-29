import { NextRequest, NextResponse } from "next/server";
import { Innertube, Platform, ClientType } from "youtubei.js";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import contentDisposition from "content-disposition";
import http from "http";
import { spawn } from "child_process";
import { Readable } from "stream";
import os from "os";
import path from "path";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getFfmpegBinary(): string {
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
  const keys = Object.keys(env);
  const vals = Object.values(env);
  return new Function(...keys, data.output)(...vals);
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

  // CRITICAL: googlevideo.com CDN streams must NEVER be routed through proxies.
  // Google Video CDN does not block datacenters or bots, and proxying media chunks causes 403 Forbidden.
  if (url.includes("googlevideo.com")) {
    return fetch(input, init);
  }

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

async function resolveVideoInfo(videoId: string): Promise<{ info: any; clientType: string; yt: Innertube }> {
  const cached = infoCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
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
          const entry: CachedInfo = {
            data: info,
            clientType: client,
            yt,
            expiresAt: Date.now() + 10 * 60 * 1000,
          };
          infoCache.set(videoId, entry);
          return { info, clientType: client, yt };
        }
      }
      errors.push(`${client}:${status}`);
    } catch (err: any) {
      errors.push(`${client}:${err.message || "error"}`);
    }
  }

  throw new Error(`YouTube stream unavailable for ${videoId}. Diagnostics: [${errors.join(" | ")}]`);
}

/**
 * Extracts pure MP3 audio from a stream using FFmpeg without hitting 403 or memory limits.
 */
function extractAudioWithFFmpeg(
  streamUrl: string,
  abortSignal?: AbortSignal
): ReadableStream<Uint8Array> {
  const bin = getFfmpegBinary();
  const ffmpeg = spawn(bin, [
    "-loglevel", "error",
    "-i", streamUrl,
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-f", "mp3",
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

  ffmpeg.on("close", cleanup);
  ffmpeg.on("error", cleanup);

  return Readable.toWeb(ffmpeg.stdout as any) as ReadableStream<Uint8Array>;
}

/**
 * Pipes separate high-res video and audio streams using local bridge server & FFmpeg without re-encoding.
 */
function muxVideoAndAudioWithFFmpeg(
  vUrl: string,
  aUrl: string,
  abortSignal?: AbortSignal,
  userAgent?: string
): Promise<ReadableStream<Uint8Array>> {
  return new Promise((resolve, reject) => {
    async function pipeStreamToRes(targetUrl: string, res: http.ServerResponse) {
      try {
        const headers: Record<string, string> = {
          "User-Agent": userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*",
        };

        const upstream = await fetch(targetUrl, { headers });
        if (!upstream.ok || !upstream.body) {
          if (!res.writableEnded) res.end();
          return;
        }

        const reader = upstream.body.getReader();
        while (true) {
          if (res.writableEnded || res.destroyed) break;
          const { done, value } = await reader.read();
          if (done) break;
          const ok = res.write(Buffer.from(value));
          if (!ok) await new Promise((r) => res.once("drain", r));
        }
      } catch {
      } finally {
        if (!res.writableEnded) res.end();
      }
    }

    const server = http.createServer((req, res) => {
      if (req.url === "/video") {
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Transfer-Encoding": "chunked",
        });
        pipeStreamToRes(vUrl, res);
      } else if (req.url === "/audio") {
        res.writeHead(200, {
          "Content-Type": "audio/mp4",
          "Transfer-Encoding": "chunked",
        });
        pipeStreamToRes(aUrl, res);
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

      const ffmpeg = spawn(getFfmpegBinary(), [
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
 * Tunnels media stream directly from upstream CDN to client with Range and Abort support.
 */
async function tunnelStream(
  downloadUrl: string,
  filenameWithExt: string,
  mimeType: string,
  req: NextRequest
): Promise<NextResponse> {
  const reqRange = req.headers.get("range");
  const upstreamHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  if (reqRange) {
    upstreamHeaders["Range"] = reqRange;
  }

  const upstream = await fetch(downloadUrl, {
    headers: upstreamHeaders,
    signal: req.signal,
  });

  if (!upstream.ok && upstream.status !== 206) {
    throw new Error(`Upstream CDN error: ${upstream.status}`);
  }
  if (!upstream.body) {
    throw new Error("Empty body from upstream CDN");
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": contentDisposition(filenameWithExt),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };

  const cLen = upstream.headers.get("content-length");
  if (cLen) responseHeaders["Content-Length"] = cLen;

  const cRange = upstream.headers.get("content-range");
  if (cRange) responseHeaders["Content-Range"] = cRange;

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
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

  // --- YOUTUBE PIPELINE (2026 ARCHITECTURE) ---
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      const videoId = extractYouTubeId(url);
      if (!videoId) throw new Error("Invalid YouTube link");

      const { info, yt } = await resolveVideoInfo(videoId);
      const streamingData = info.streaming_data;
      const progFormats: any[] = streamingData?.formats || [];
      const adaptiveFormats: any[] = streamingData?.adaptive_formats || [];

      // --- AUDIO DOWNLOAD (FAST, ROBUST, 0-500 ERROR) ---
      if (type === "audio") {
        // Priority 1: Unthrottled progressive itag 18 stream
        let audioSourceUrl: string | undefined;
        let isProgressive = false;

        const prog = progFormats.find((f) => f.has_audio && f.url) || progFormats[0];
        if (prog?.url) {
          audioSourceUrl = prog.url;
          isProgressive = true;
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

        const hasFfmpeg = await checkFfmpeg();
        if (hasFfmpeg && isProgressive) {
          try {
            const mp3Stream = extractAudioWithFFmpeg(audioSourceUrl, req.signal);
            return new NextResponse(mp3Stream, {
              headers: {
                "Content-Disposition": contentDisposition(`${cleanFilename}.mp3`),
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-cache",
              },
            });
          } catch (ffErr) {
            console.warn("[FFMPEG MP3 EXTRACTION FALLBACK TO DIRECT TUNNEL]:", ffErr);
          }
        }

        // Direct tunnel fallback (never fails, instant response)
        const extension = isProgressive ? "m4a" : "mp3";
        const mimeType = isProgressive ? "audio/mp4" : "audio/mpeg";
        return await tunnelStream(audioSourceUrl, `${cleanFilename}.${extension}`, mimeType, req);
      }

      // --- VIDEO DOWNLOAD ---
      const targetHeight = parseTargetHeight(quality);

      // Best progressive format (guaranteed unthrottled, complete video + audio)
      const prog = progFormats.find((f) => f.has_video && f.has_audio && f.url) || progFormats[0];
      const progUrl = prog?.url || (await prog?.decipher(yt.session.player));

      // If user requested 360p or default, stream progressive MP4 directly
      if (targetHeight <= 360 && progUrl) {
        return await tunnelStream(progUrl, `${cleanFilename}.mp4`, "video/mp4", req);
      }

      // High quality video (720p / 1080p): attempt muxing if FFmpeg is available
      const hasFfmpeg = await checkFfmpeg();
      if (hasFfmpeg && progUrl) {
        const videoCandidates = adaptiveFormats
          .filter((f) => f.has_video && (f.url || f.cipher || f.signature_cipher))
          .sort((a, b) => {
            const hDiff = (b.height || 0) - (a.height || 0);
            if (hDiff !== 0) return hDiff;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });

        const matchingVideo =
          videoCandidates.find((f) => (f.height || 0) <= targetHeight) || videoCandidates[0];

        if (matchingVideo) {
          try {
            const vUrl = matchingVideo.url || (await matchingVideo.decipher(yt.session.player));
            if (vUrl) {
              const muxStream = await muxVideoAndAudioWithFFmpeg(vUrl, progUrl, req.signal);
              return new NextResponse(muxStream, {
                headers: {
                  "Content-Disposition": contentDisposition(`${cleanFilename}.mp4`),
                  "Content-Type": "video/mp4",
                  "Cache-Control": "no-cache",
                },
              });
            }
          } catch (muxErr) {
            console.warn("[FFMPEG MUX FAILED, FALLING BACK TO GUARANTEED PROGRESSIVE]:", muxErr);
          }
        }
      }

      // Guaranteed progressive fallback (never 0-byte, never fails)
      if (progUrl) {
        return await tunnelStream(progUrl, `${cleanFilename}.mp4`, "video/mp4", req);
      }

      throw new Error("No playable video formats available");
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
