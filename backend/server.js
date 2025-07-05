const express = require("express");
const cors = require("cors");
const ytdl = require("@distube/ytdl-core");
const contentDisposition = require("content-disposition");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
app.use(cors());

const API_PREFIX = '/api'; 

// --- Rutas de tu API  ---
app.get(`${API_PREFIX}/video-info`, async (req, res) => {
    console.log(`[API-INFO] Request received for /video-info with URL: ${req.query.url}`);

    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
        console.error(`[API-INFO ERROR] Invalid URL provided: ${videoURL}`);
        return res.status(400).send({ error: "URL inválida." });
    }

    try {
        // Para ejecución local, ytdl-core normalmente funciona sin necesidad de cookies ni proxies.
        const info = await ytdl.getInfo(videoURL);

        const bestAudioFormat = ytdl
            .filterFormats(info.formats, "audioonly")
            .find((f) => f.container === "mp4" && f.audioBitrate);

        const videoFormats = info.formats
            .filter(
                (f) =>
                f.container === "mp4" &&
                f.qualityLabel &&
                parseInt(f.qualityLabel) <= 1080
            )
            .map((f) => ({
                itag: f.itag,
                quality: f.qualityLabel,
                hasAudio: f.hasAudio,
                audioItag: f.hasAudio
                ? null
                : bestAudioFormat
                ? bestAudioFormat.itag
                : null,
            }))
            .filter((v, i, a) => a.findIndex((t) => t.quality === v.quality) === i)
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        const audioFormats = info.formats
            .filter((f) => f.container === "mp4" && f.audioBitrate === 128)
            .map((f) => ({ itag: f.itag, quality: `${f.audioBitrate}kbps` }))
            .filter((v, i, a) => a.findIndex((t) => t.quality === v.quality) === i);

        res.json({
            title: info.videoDetails.title || "Título no disponible",
            thumbnail: info.videoDetails.thumbnails.pop().url,
            videoFormats,
            audioFormats,
        });
        console.log(`[API-INFO] Successfully fetched info for: ${info.videoDetails.title}`);
    } catch (error) {
        console.error(`[VIDEO_INFO ERROR]`, error.message);
        res.status(500).send({ error: "Error al obtener info del video." });
    }
});

app.get(`${API_PREFIX}/download`, async (req, res) => {
    console.log(`[API-DOWNLOAD] Request received for /download (Format: ${req.query.format}, Title: ${req.query.title})`);

    const { url, title = "video", format, videoItag, audioItag } = req.query;

    if (!ytdl.validateURL(url)) {
        console.error(`[API-DOWNLOAD ERROR] Invalid URL for download: ${url}`);
        return res.status(400).send({ error: "URL inválida." });
    }

    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-_.]/g, "_");
    res.setHeader(
        "Content-Disposition",
        contentDisposition(`${sanitizedTitle}.${format}`)
    );

    try {
        if (format === "mp3") {
            res.setHeader("Content-Type", "audio/mpeg");
            ffmpeg.setFfmpegPath(ffmpegPath);
            const audioStream = ytdl(url, { quality: "highestaudio" });
            ffmpeg(audioStream).audioBitrate(128).toFormat("mp3").pipe(res);
            console.log(`[API-DOWNLOAD] Streaming MP3 for: ${sanitizedTitle}`);
        } else if (format === "mp4") {
            res.setHeader("Content-Type", "video/mp4");
            if (audioItag) {
                const videoStream = ytdl(url, { quality: videoItag });
                const audioStream = ytdl(url, {
                    quality: audioItag,
                    filter: "audioonly",
                });
                const ffmpegArgs = [
                    "-i", "pipe:3",
                    "-i", "pipe:4",
                    "-map", "0:v",
                    "-map", "1:a",
                    "-c:v", "copy",
                    "-c:a", "copy",
                    "-f", "mp4",
                    "-movflags", "frag_keyframe+empty_moov",
                    "pipe:1",
                ];
                const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
                    stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
                });
                videoStream.pipe(ffmpegProcess.stdio[3]);
                audioStream.pipe(ffmpegProcess.stdio[4]);
                ffmpegProcess.stdio[1].pipe(res);
                ffmpegProcess.on("close", () => {
                    console.log(`[API-DOWNLOAD] MP4 (video+audio) stream finished for: ${sanitizedTitle}`);
                    if (!res.headersSent) res.end();
                });
                ffmpegProcess.on("error", (err) => {
                    console.error(`[API-DOWNLOAD ERROR] FFmpeg process error: ${err.message}`);
                    if (!res.headersSent) res.status(500).send("Error en el procesamiento del video.");
                    res.end();
                });
            } else {
                ytdl(url, { quality: videoItag }).pipe(res);
                console.log(`[API-DOWNLOAD] Streaming MP4 (video only) for: ${sanitizedTitle}`);
            }
        }
    } catch (error) {
        console.error(`[DOWNLOAD FATAL]`, error.message);
        if (!res.headersSent) res.status(500).send("Error inesperado en la descarga.");
        res.end();
    }
});

// Manejador de errores para rutas no encontradas (404)
app.use((req, res) => {
    console.error(`[EXPRESS 404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `La ruta '${req.originalUrl}' no fue encontrada en la API.` });
});

// Manejador de errores general (500)
app.use((err, req, res, next) => {
    console.error(`[EXPRESS ERROR]`, err.stack);
    res.status(500).json({ error: "Un error interno del servidor ha ocurrido." });
});

const LOCAL_API_PORT = process.env.PORT || 3001; // Puerto por defecto para la API local
app.listen(LOCAL_API_PORT, () => {
    console.log(`[LOCAL API] Servidor API Express ejecutándose en http://localhost:${LOCAL_API_PORT}`);
    console.log(`[LOCAL API] Asegúrate de que API_BASE_URL en youtube-downloader-frontend/src/App.jsx apunte a: http://localhost:${LOCAL_API_PORT}${API_PREFIX}`);
});