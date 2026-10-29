import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function muxVideo(
  videoUrl: string, audioUrl: string, height: number,
  binary: string, transport: typeof fetch, signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const directory = await mkdtemp(join(tmpdir(), "clipdrop-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const download = async (url: string, filename: string) => {
      const response = await transport(url, { signal });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(`Media download failed: HTTP ${response.status}`);
      }
      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(filename), { signal });
      if (!(await stat(filename)).size) throw new Error("Media source returned an empty file");
    };
    const video = join(directory, "video");
    const audio = join(directory, "audio");
    const output = join(directory, "output.mp4");
    await download(videoUrl, video);
    await download(audioUrl, audio);
    const run = (args: string[]) => new Promise<string>((resolve, reject) => {
      const child = spawn(binary, args, { signal });
      let diagnostic = "";
      child.stdout.resume();
      child.stderr.on("data", (chunk) => { diagnostic = (diagnostic + chunk).slice(-16000); });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(diagnostic);
        else reject(new Error(`FFmpeg failed (${code}): ${diagnostic}`));
      });
    });
    await run(["-nostdin", "-y", "-v", "error", "-i", video, "-i", audio,
      "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
      "-movflags", "+faststart", output]);
    if (!(await stat(output)).size) throw new Error("FFmpeg produced an empty video");
    // Decode a frame and check the actual output dimensions before sending HTTP 200.
    const inspection = await run(["-nostdin", "-v", "info", "-i", output,
      "-map", "0:v:0", "-map", "0:a:0", "-frames:v", "1", "-f", "null", "-"]);
    const dimensions = inspection.match(/Video:[^\r\n]*?\b(\d{2,5})x(\d{2,5})\b/);
    if (!dimensions || Number(dimensions[2]) !== height) {
      throw new Error(`Output resolution does not match requested ${height}p`);
    }
    const stream = createReadStream(output);
    stream.once("close", () => { void cleanup().catch(console.error); });
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
