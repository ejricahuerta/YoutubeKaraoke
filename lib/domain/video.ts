/** YouTube videos as the app sees them: ids, thumbnails, search queries and titles. */
import type { SearchKind } from "./types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID_PATTERN.test(value);
}

/**
 * Where the main screen's player is framed from: YouTube's privacy-enhanced mode, which sets
 * no YouTube cookies until a video plays (docs/adr/0018). The IFrame API script itself still
 * comes from www.youtube.com.
 */
export const YOUTUBE_PLAYER_HOST = "https://www.youtube-nocookie.com";

const THUMBNAIL_FILES = { row: "mqdefault", poster: "hqdefault" } as const;

/** YouTube's own image for a video: "row" for lists, "poster" for the paused player. */
export function thumbnailUrl(videoId: string, size: keyof typeof THUMBNAIL_FILES = "row"): string {
  return `https://i.ytimg.com/vi/${videoId}/${THUMBNAIL_FILES[size]}.jpg`;
}

export const SEARCH_QUERY_MAX_LENGTH = 120;

/** Adds "karaoke" or "lyrics" to the query unless the user already typed it. */
export function buildSearchQuery(input: string, kind: SearchKind): string {
  const query = input.slice(0, SEARCH_QUERY_MAX_LENGTH).trim().replace(/\s+/g, " ");
  if (!query) return "";
  return new RegExp(`\\b${kind}\\b`, "i").test(query) ? query : `${query} ${kind}`;
}

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
