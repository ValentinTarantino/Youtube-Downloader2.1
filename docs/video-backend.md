# Video backend

YouTube video downloads use yt-dlp, Node.js for player challenges, and FFmpeg.
Windows defaults to `.tools/yt-dlp.exe`; Linux defaults to `yt-dlp` on PATH.
Set `YTDLP_BINARY` to override the executable path. Install the executable from
the official yt-dlp GitHub release. `.tools` is excluded from version control.

The downloader selects the smallest source at or above the requested height.
Native resolutions are retained; missing intermediate sizes such as 480p are
downscaled with FFmpeg. It never enlarges a lower-resolution source. The final
file must contain video and audio, have the requested height, and be nonempty
before the API sends success. Temporary files are removed after the response.

Run `node scripts/verify-youtube-video.cjs` for real downloads at 720p, 480p and
360p. It requires network access and writes the verified files under `.tools`.

This backend needs a machine/container with the three runtimes and temporary
disk space. The local Windows executable is not a Linux/Vercel deployment.
Keep the frontend on Vercel and deploy this processing backend separately.

## Container staging deployment

The image in `Dockerfile.backend` installs yt-dlp 2026.10.26 (the version tested
locally), Node 22, Python and FFmpeg. Secrets and local binaries are excluded
from the Docker build context. Docker must be installed on the destination.

On a Linux server, from the repository directory:

```sh
export DOWNLOAD_BACKEND_TOKEN="$(openssl rand -hex 32)"
docker compose -f compose.backend.yml up -d --build
export DOWNLOAD_BACKEND_URL=http://127.0.0.1:3001
node scripts/check-backend.mjs
```

Keep the generated token in the host's secret manager for subsequent starts.
The verification script checks authentication, downloads three video resolutions
and MP3, and saves the results in `.tools/server-*`. The video backend checks
dimensions and audio before responding. A healthy container alone does not
prove YouTube downloads work from that host.

Compose only exposes localhost port 3001. After successful testing, configure
an HTTPS reverse proxy for the backend subdomain. The bearer token belongs in
server-side secrets, never a `NEXT_PUBLIC_*` variable or browser bundle.
Do not expose this staging backend as a public download service yet: public
integration still requires the job queue, concurrency limits and file delivery.

The frontend has not yet been redirected to this backend. That integration
follows successful downloads from the chosen host, as agreed.
