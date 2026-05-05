import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import contentDisposition from "content-disposition";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const type = req.nextUrl.searchParams.get("type") || "video";
  const quality = req.nextUrl.searchParams.get("quality");
  const rawFilename = req.nextUrl.searchParams.get("filename") || "download";

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const extension = type === "audio" ? "mp3" : "mp4";
  const mimeType = type === "audio" ? "audio/mpeg" : "video/mp4";

  const cleanFilename = rawFilename
    .replace(/[^a-zA-Z0-9\s\-_.()]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 120);
  const filenameWithExt = `${cleanFilename}.${extension}`;

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          },
        },
      });

      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s\-_.]/g, "_");
      let format;

      if (type === "audio") {
        try {
          format = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
        } catch (e) {
          format = info.formats.find(f => f.hasAudio);
        }
      } else {
        format = info.formats.find(f =>
          f.container === "mp4" &&
          f.hasAudio &&
          f.hasVideo &&
          (quality === "max" ? true : f.qualityLabel?.includes(quality || "1080"))
        );
        if (!format) {
          format = ytdl.chooseFormat(info.formats, { filter: "audioandvideo", quality: "highest" });
        }
      }

      if (!format) throw new Error("No compatible format found.");

      const stream = ytdl.downloadFromInfo(info, { format });
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', chunk => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', err => controller.error(err));
        },
        cancel() { stream.destroy(); }
      });

      return new NextResponse(readableStream, {
        headers: {
          "Content-Disposition": contentDisposition(`${title}.${extension}`),
          "Content-Type": mimeType,
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("[YOUTUBE PROXY ERROR]", error);
      return NextResponse.json({ error: "YouTube download failed" }, { status: 500 });
    }
  }

  // --- TUNNEL ENGINE (TIKTOK / INSTAGRAM / ALL OTHER PLATFORMS) ---
  // Streams the remote file directly to the browser with the correct headers
  // so Chrome recognises the file type and saves it with the right extension.
  try {
    const response = await fetch(url, {
      headers: {
        "Referer": url.includes("instagram") ? "https://www.instagram.com/" : "https://www.tiktok.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      }
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
