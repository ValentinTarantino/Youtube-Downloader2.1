# VidFetch deployment

Set `VIDFETCH_API_KEY` as a server-side environment variable on Vercel or Render,
then deploy these changes. Never use a `NEXT_PUBLIC_` prefix. Local development
reads the ignored `.env.local` file. No API key is included in source control.

The browser creates a job through `POST /api/jobs` and polls `GET /api/jobs`
with a signed, expiring job ticket. Provider credentials stay on the server.
The browser downloads through `/api/jobs?ticket=...&download=1`. That endpoint
validates the ticket, retrieves the provider's HTTPS link and streams the bytes
with `Content-Disposition: attachment`, preserving Content-Length and Range
responses. It does not buffer the whole file or expose API credentials to storage.
Vercel does not execute FFmpeg or yt-dlp, but now relays media: hosting transfer
quotas and the route's 300-second maximum duration apply. Provider processing
must finish before browser downloading begins.
Render's existing `/api/download` bearer protection remains unchanged; the
new frontend uses `/api/jobs` when the provider is configured.

Without the environment variable, local downloads fall back to the previous
yt-dlp flow. Provider failures never silently trigger a second download.

`node scripts/check-vidfetch.cjs` checks the reference video at 720p and MP3.
It creates at most one saved job per format in `.tools`, reuses those jobs on
subsequent runs, downloads the files and verifies them with FFmpeg. Initial
successful jobs consume provider quota; inspect billing in the dashboard.

The provider advertises 1 GB/month free with a 20 MB minimum per successful
job. This integration is a demo, not an unlimited service: job creation is
public and does not yet implement persistent per-user quotas. Do not enable
automatic paid top-ups for a zero-budget deployment. Same-origin checks do
not substitute for user authentication or server-side usage quotas.
