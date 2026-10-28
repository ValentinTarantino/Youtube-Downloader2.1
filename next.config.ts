/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/download": ["./node_modules/ffmpeg-static/**"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
