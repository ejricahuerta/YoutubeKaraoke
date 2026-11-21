import type { SearchKind } from "./types";

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Adds "karaoke" or "lyrics" to the query unless the user already typed it. */
export function buildSearchQuery(q: string, kind: SearchKind): string {
  const query = q.trim().replace(/\s+/g, " ");
  if (!query) return "";
  return new RegExp(`\\b${kind}\\b`, "i").test(query) ? query : `${query} ${kind}`;
}

export function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
