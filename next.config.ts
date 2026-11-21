import type { NextConfig } from "next";

/**
 * Sent with every response. This is the part of issue #18 that cannot break playback.
 * A full Content-Security-Policy (script, frame and connect sources) is left out on purpose
 * until it can be tried against real YouTube playback and Supabase Realtime.
 */
const SECURITY_HEADERS = [
  // No other site may put the app in a frame (clickjacking). Two headers: old and new browsers.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Must keep sending the origin: YouTube's embedded player will not play without a referrer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Features the app never uses. Fullscreen, autoplay and the wake lock are deliberately not listed.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["youtubei.js"],
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
