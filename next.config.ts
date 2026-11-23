import type { NextConfig } from "next";
import { securityHeaders } from "./lib/server/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["youtubei.js"],
  images: { unoptimized: true },
  poweredByHeader: false,
  // Development only: lets phones and TVs on the same home network open the dev server by its
  // LAN address (https://192.168.x.x:3001), which Next would otherwise block. Ignored by builds.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  async headers() {
    const headers = securityHeaders({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      dev: process.env.NODE_ENV === "development",
    });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
