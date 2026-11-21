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

const VIDEO_WORDS = "karaoke|lyrics?|instrumental|backing track|official|audio|video|hd|hq|4k";
const BRACKETED = new RegExp(`\\s*[(\\[][^)\\]]*\\b(?:${VIDEO_WORDS})\\b[^)\\]]*[)\\]]`, "gi");
const TRAILING = new RegExp(`\\s*[-|:•]\\s*(?:with\\s+)?(?:${VIDEO_WORDS})\\b.*$`, "i");

/**
 * A song title without video boilerplate such as "(Karaoke Version)" or "| Lyrics", for
 * places where the room reads it from a distance. Search results keep the full title.
 */
export function displayTitle(title: string): string {
  const cleaned = title.replace(BRACKETED, "").replace(TRAILING, "").replace(/\s+/g, " ").trim();
  return cleaned || title;
}
