import type { SearchResult } from "./types";
import { thumbnailFor, VIDEO_ID_PATTERN } from "./format";

/**
 * Keyless YouTube search via youtubei.js (the same internal API the website
 * uses). Unofficial: it can break or be throttled. Everything that touches
 * YouTube lives in this file, so another provider can replace searchVideos().
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 6000;
const MAX_RESULTS = 20;
const cache = new Map<string, { at: number; results: SearchResult[] }>();

type Innertube = { search(query: string, filters?: { type?: "video" }): Promise<{ results?: Iterable<unknown> }> };
let clientPromise: Promise<Innertube> | null = null;

function getClient(): Promise<Innertube> {
  clientPromise ??= import("youtubei.js")
    .then(({ Innertube }) => Innertube.create({ retrieve_player: false, generate_session_locally: true }))
    .then((yt) => yt as unknown as Innertube)
    .catch((err) => {
      clientPromise = null;
      throw err;
    });
  return clientPromise;
}

type VideoNode = {
  type?: string;
  video_id?: string;
  id?: string;
  title?: { text?: string; toString(): string };
  author?: { name?: string };
  duration?: { seconds?: number };
  is_live?: boolean;
  is_upcoming?: boolean;
};

/** Maps one search result node to our shape; null for anything that is not a normal video. */
export function mapVideoNode(raw: unknown): SearchResult | null {
  const node = raw as VideoNode | null;
  if (!node || node.type !== "Video") return null;
  const videoId = node.video_id ?? node.id ?? "";
  if (!VIDEO_ID_PATTERN.test(videoId)) return null;
  if (node.is_live || node.is_upcoming) return null;
  const durationSeconds = Math.floor(node.duration?.seconds ?? 0);
  if (!(durationSeconds > 0)) return null; // live streams and odd entries have no length
  const title = (node.title?.text ?? node.title?.toString() ?? "").trim();
  if (!title) return null;
  return {
    videoId,
    title,
    channel: (node.author?.name ?? "").trim(),
    thumbnailUrl: thumbnailFor(videoId),
    durationSeconds,
  };
}

export async function searchVideos(query: string): Promise<SearchResult[]> {
  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("YouTube search timed out")), TIMEOUT_MS);
  });
  try {
    const search = await Promise.race([getClient().then((yt) => yt.search(query, { type: "video" })), timeout]);
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const node of search.results ?? []) {
      const mapped = mapVideoNode(node);
      if (!mapped || seen.has(mapped.videoId)) continue;
      seen.add(mapped.videoId);
      results.push(mapped);
      if (results.length >= MAX_RESULTS) break;
    }
    if (cache.size > 500) cache.clear();
    cache.set(key, { at: Date.now(), results });
    return results;
  } finally {
    clearTimeout(timer);
  }
}
