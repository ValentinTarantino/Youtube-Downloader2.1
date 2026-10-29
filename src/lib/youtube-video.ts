import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { Readable } from "node:stream";

function run(binary: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(binary, args, { signal, windowsHide: true });
    let diagnostic = "";
    const collect = (chunk: Buffer) => { diagnostic = (diagnostic + chunk).slice(-24000); };
    process.stdout.on("data", collect);
    process.stderr.on("data", collect);
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve(diagnostic) : reject(new Error(`Download process failed (${code}): ${diagnostic}`)));
  });
}

export async function downloadYouTubeVideo(videoId: string, height: number, ffmpeg: string, signal?: AbortSignal) {
  if (!/^[\w-]{11}$/.test(videoId) || ![360, 480, 720, 1080].includes(height)) {
    throw new Error("Invalid video ID or resolution");
  }
  const binary = process.env.YTDLP_BINARY || (process.platform === "win32"
    ? join(process.cwd(), ".tools", "yt-dlp.exe") : "yt-dlp");
  const directory = await mkdtemp(join(tmpdir(), "clipdrop-video-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const source = join(directory, "source.mp4");
    const args = ["--ignore-config", "--no-playlist", "--no-progress", "--no-part",
      "--socket-timeout", "20", "--retries", "2", "--fragment-retries", "2",
      "--js-runtimes", `node:${process.execPath}`, "--ffmpeg-location", dirname(ffmpeg),
      "--format", `bv[height>=${height}][ext=mp4]+ba[ext=m4a]/b[height>=${height}][ext=mp4]`,
      "--format-sort", "+res", "--merge-output-format", "mp4", "--output", source];
    if (process.env.YOUTUBE_PROXY) args.push("--proxy", process.env.YOUTUBE_PROXY);
    args.push(`https://www.youtube.com/watch?v=${videoId}`);
    await run(binary, args, signal);
    const inspect = async (file: string) => {
      const diagnostic = await run(ffmpeg, ["-nostdin", "-v", "info", "-i", file,
        "-map", "0:v:0", "-map", "0:a:0", "-frames:v", "1", "-f", "null", "-"], signal);
      const match = diagnostic.match(/Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);
      if (!match) throw new Error("Cannot verify downloaded video dimensions");
      return Number(match[2]);
    };
    let output = source;
    const sourceHeight = await inspect(source);
    if (sourceHeight < height) throw new Error(`Source is below requested ${height}p`);
    if (sourceHeight > height) {
      output = join(directory, "output.mp4");
      await run(ffmpeg, ["-nostdin", "-y", "-v", "error", "-i", source,
        "-map", "0:v:0", "-map", "0:a:0", "-vf", `scale=-2:${height}`,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "copy",
        "-movflags", "+faststart", output], signal);
      if (await inspect(output) !== height) throw new Error("Converted resolution mismatch");
    }
    const size = (await stat(output)).size;
    if (!size) throw new Error("Downloaded video is empty");
    const stream = createReadStream(output);
    const abort = () => stream.destroy(new Error("Download aborted"));
    stream.once("close", () => {
      signal?.removeEventListener("abort", abort);
      void cleanup().catch(console.error);
    });
    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    return { body, size, height };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
