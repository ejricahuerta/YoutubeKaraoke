import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["youtubei.js"],
  images: { unoptimized: true },
};

export default nextConfig;
