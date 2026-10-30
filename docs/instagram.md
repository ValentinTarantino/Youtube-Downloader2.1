# Instagram Reels

Instagram uses its own extractor in src/lib/instagram.ts. YouTube and TikTok are unchanged.

Configure INSTAGRAM_API_KEY (or RAPIDAPI_KEY for compatibility) in Vercel project settings → Environment Variables, enable it for Production (and Preview if used), then create a new deployment. Existing deployments do not receive newly added variables. The key must have a subscription to the selected Download All in One API.

Default host: instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com
Endpoint: GET /fetch?url=<public Instagram reel URL>
Optional server variable: INSTAGRAM_API_HOST (must implement the same /fetch contract).

The parser reads download_url and identified video fields. Photo URLs and Instagram page links are rejected. It does not remove watermarks embedded in the original video.

Run node --test tests/instagram.test.cjs for mocked checks. A real download test requires an active provider subscription and a public reel. Never expose RAPIDAPI_KEY with a NEXT_PUBLIC_ prefix.
