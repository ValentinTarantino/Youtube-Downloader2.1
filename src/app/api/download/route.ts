import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import contentDisposition from "content-disposition";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const type = req.nextUrl.searchParams.get("type");
  const quality = req.nextUrl.searchParams.get("quality");

  if (!url || !ytdl.validateURL(url)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  try {
    console.log(`[DOWNLOAD] Solicitando info para: ${url} (${type})`);
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        },
      },
    });
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
    let format;

    if (type === "audio") {
      try {
        format = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
      } catch (e) {
        // Fallback: buscar cualquier formato que tenga audio
        format = info.formats.find(f => f.hasAudio);
      }
    } else {
      // Find the best mp4 format with video and audio
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

    if (!format) {
      throw new Error("No se encontró un formato compatible para este video.");
    }

    console.log(`[DOWNLOAD] Formato encontrado: itag=${format.itag}, quality=${format.qualityLabel || 'audio'}`);

    const stream = ytdl.downloadFromInfo(info, { format });

    // Next.js NextResponse accepts a ReadableStream, we convert the Node stream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', chunk => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', err => {
          console.error("[STREAM ERROR]", err);
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      }
    });

    const extension = type === "audio" ? "mp3" : "mp4";
    const contentType = type === "audio" ? "audio/mpeg" : "video/mp4";

    return new NextResponse(readableStream, {
      headers: {
        "Content-Disposition": contentDisposition(`${title}.${extension}`),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("[API ERROR]", error);
    return NextResponse.json({ 
      error: (error as Error).message,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 });
  }
}
