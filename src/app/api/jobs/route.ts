import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import contentDisposition from "content-disposition";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const API = "https://api.vidfetch.dev/v1/downloads";
const formats = new Set(["360p", "480p", "720p", "mp3"]);
function providerKeys() {
  return [...new Set([process.env.VIDFETCH_API_KEY, process.env.VIDFETCH_API_KEY_BACKUP]
    .map(key => key?.trim()).filter((key): key is string => Boolean(key)))];
}
class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
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
    throw new ProviderError(response.status, response.status === 402 ? "The provider's download quota has been exhausted."
      : response.status === 429 ? "The provider is busy. Please try again later."
      : `The provider rejected the request (HTTP ${response.status}).`);
  }
  return response.json();
}
export async function POST(req: NextRequest) {
  const keys = providerKeys();
  if (!keys.length) return NextResponse.json({ unavailable: true }, { status: 503 });
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  try {
    const { url: raw, format } = await req.json();
    const url = new URL(raw);
    if (!formats.has(format) || !["https:", "http:"].includes(url.protocol)
      || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)) {
      return NextResponse.json({ error: "Invalid link or format." }, { status: 400 });
    }
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1)
      : url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return NextResponse.json({ error: "Invalid video." }, { status: 400 });
    let key = keys[0];
    let job;
    for (let index = 0; index < keys.length; index++) {
      key = keys[index];
      try {
        job = await call(key, undefined, { url: `https://www.youtube.com/watch?v=${id}`, format });
        break;
      } catch (error) {
        // Retry only a definite quota rejection, never an ambiguous timeout or 5xx.
        if (!(error instanceof ProviderError) || error.status !== 402 || index === keys.length - 1) throw error;
      }
    }
    if (!job.id) throw new Error("The provider did not return a valid job.");
    const expiry = Date.now() + 60 * 60 * 1000;
    return NextResponse.json({ ...safeJob(job), ticket: `${job.id}.${expiry}.${sign(job.id, expiry, key)}` }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the download." }, { status: 502 });
  }
}
export async function GET(req: NextRequest) {
  const keys = providerKeys();
  if (!keys.length) return NextResponse.json({ error: "Provider not configured." }, { status: 503 });
  const [id, expires, signature, extra] = (req.nextUrl.searchParams.get("ticket") || "").split(".");
  const expiry = Number(expires);
  if (!id || extra || !Number.isFinite(expiry) || expiry < Date.now() || !/^[a-f0-9]{64}$/.test(signature || "")) {
    return NextResponse.json({ error: "Invalid or expired job." }, { status: 403 });
  }
  // The signature binds each existing job to the account that created it.
  const key = keys.find(candidate => timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id, expiry, candidate))));
  if (!key) {
    return NextResponse.json({ error: "Invalid job." }, { status: 403 });
  }
  try {
    const job = await call(key, id);
    const result = safeJob(job);
    if (req.nextUrl.searchParams.get("download") === "1") {
      if (result.status !== "completed" || !result.downloadUrl) {
        return NextResponse.json({ error: "The file is not available yet." }, { status: 409 });
      }
      const headers = new Headers({ "Accept-Encoding": "identity" });
      const range = req.headers.get("range");
      if (range) headers.set("Range", range);
      // Only use the URL returned by the authenticated provider, never a client URL.
      // No API credentials are forwarded to file storage.
      const upstream = await fetch(result.downloadUrl, { headers, signal: req.signal, cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        const errorHeaders = new Headers();
        if (upstream.status === 416 && upstream.headers.has("content-range")) {
          errorHeaders.set("Content-Range", upstream.headers.get("content-range")!);
        }
        return NextResponse.json({ error: "Could not transfer the file." }, {
          status: upstream.status === 416 ? 416 : 502, headers: errorHeaders,
        });
      }
      const extension = job.format === "mp3" ? "mp3" : "mp4";
      const title = String(job.title || "download").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 150);
      const responseHeaders = new Headers({
        "Content-Type": extension === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": contentDisposition(`${title}.${extension}`),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      for (const name of ["content-length", "content-range", "accept-ranges"]) {
        const value = upstream.headers.get(name);
        if (value && !upstream.headers.get("content-encoding")) responseHeaders.set(name, value);
      }
      return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check the job." }, { status: 502 });
  }
}
