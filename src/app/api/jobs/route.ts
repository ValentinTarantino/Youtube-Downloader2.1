import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const API = "https://api.vidfetch.dev/v1/downloads";
const formats = new Set(["360p", "480p", "720p", "mp3"]);
function sign(id: string, expiry: number, key: string) {
  return createHmac("sha256", key).update(`${id}:${expiry}`).digest("hex");
}
function safeJob(job: any) {
  let downloadUrl: string | undefined;
  if (job.status === "completed" && typeof job.download_url === "string") {
    const url = new URL(job.download_url);
    if (url.protocol === "https:") downloadUrl = url.href;
  }
  return { status: job.status, progress: job.progress, downloadUrl,
    error: job.error_message || (typeof job.error === "string" ? job.error : undefined) };
}
async function call(key: string, id?: string, body?: object) {
  const response = await fetch(id ? `${API}/${encodeURIComponent(id)}` : API, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store", signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    throw new Error(response.status === 402 ? "Se agotó el cupo de descargas del proveedor."
      : response.status === 429 ? "El proveedor está ocupado. Intentá más tarde."
      : `El proveedor rechazó la solicitud (HTTP ${response.status}).`);
  }
  return response.json();
}
export async function POST(req: NextRequest) {
  const key = process.env.VIDFETCH_API_KEY;
  if (!key) return NextResponse.json({ unavailable: true }, { status: 503 });
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  try {
    const { url: raw, format } = await req.json();
    const url = new URL(raw);
    if (!formats.has(format) || !["https:", "http:"].includes(url.protocol)
      || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)) {
      return NextResponse.json({ error: "Enlace o formato no válido." }, { status: 400 });
    }
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1)
      : url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: "Video no válido." }, { status: 400 });
    const job = await call(key, undefined, { url: `https://www.youtube.com/watch?v=${id}`, format });
    if (!job.id) throw new Error("El proveedor no devolvió un trabajo válido.");
    const expiry = Date.now() + 60 * 60 * 1000;
    return NextResponse.json({ ...safeJob(job), ticket: `${job.id}.${expiry}.${sign(job.id, expiry, key)}` }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la descarga." }, { status: 502 });
  }
}
export async function GET(req: NextRequest) {
  const key = process.env.VIDFETCH_API_KEY;
  if (!key) return NextResponse.json({ error: "Proveedor no configurado." }, { status: 503 });
  const [id, expires, signature, extra] = (req.nextUrl.searchParams.get("ticket") || "").split(".");
  const expiry = Number(expires);
  if (!id || extra || !Number.isFinite(expiry) || expiry < Date.now() || !/^[a-f0-9]{64}$/.test(signature || "")) {
    return NextResponse.json({ error: "Trabajo inválido o vencido." }, { status: 403 });
  }
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id, expiry, key)))) {
    return NextResponse.json({ error: "Trabajo inválido." }, { status: 403 });
  }
  try {
    return NextResponse.json(safeJob(await call(key, id)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar el trabajo." }, { status: 502 });
  }
}
