import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const configured = process.env.DOWNLOAD_BACKEND_MODE !== "true" || Boolean(process.env.DOWNLOAD_BACKEND_TOKEN);
  return NextResponse.json({ status: configured ? "ok" : "unconfigured" }, { status: configured ? 200 : 503 });
}
