import type { NextConfig } from "next";
import { securityHeaders } from "./lib/server/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["youtubei.js"],
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    const headers = securityHeaders({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      dev: process.env.NODE_ENV === "development",
    });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
