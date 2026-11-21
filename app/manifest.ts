import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Karaoke",
    short_name: "Karaoke",
    description: "Karaoke night with a shared queue: one big screen, every phone in the room.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a10",
    theme_color: "#0b0a10",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
