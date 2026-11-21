import type { SearchResult } from "@/lib/domain/types";
import { isVideoId, thumbnailUrl } from "@/lib/domain/video";

/**
 * Keyless YouTube search via youtubei.js (the same internal API the website
 * uses). Unofficial: it can break or be throttled. Everything that touches
 * YouTube lives in this file, so another provider can replace searchVideos().
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_QUERIES = 500;
const SEARCH_TIMEOUT_MS = 6000;
const EMBED_CHECK_TIMEOUT_MS = 2500;
const EMBED_CACHE_MAX_VIDEOS = 5000;
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
  if (!isVideoId(videoId)) return null;
  if (node.is_live || node.is_upcoming) return null;
  const durationSeconds = Math.floor(node.duration?.seconds ?? 0);
  if (!(durationSeconds > 0)) return null; // live streams and odd entries have no length
  const title = (node.title?.text ?? node.title?.toString() ?? "").trim();
  if (!title) return null;
  return {
    videoId,
    title,
    channel: (node.author?.name ?? "").trim(),
    thumbnailUrl: thumbnailUrl(videoId),
    durationSeconds,
  };
}

const embeddable = new Map<string, boolean>();

/**
 * Whether the video can play in an embedded player. Many karaoke channels turn
 * embedding off; YouTube's oEmbed endpoint answers 401/403 for those. If the
 * check itself fails we assume yes: the main screen skips unplayable videos anyway.
 */
export async function isEmbeddable(videoId: string): Promise<boolean> {
  const known = embeddable.get(videoId);
  if (known !== undefined) return known;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(EMBED_CHECK_TIMEOUT_MS) },
    );
    const ok = res.status !== 401 && res.status !== 403 && res.status !== 404;
    if (embeddable.size > EMBED_CACHE_MAX_VIDEOS) embeddable.clear();
    embeddable.set(videoId, ok);
    return ok;
  } catch {
    return true;
  }
}

export async function searchVideos(query: string): Promise<SearchResult[]> {
  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("YouTube search timed out")), SEARCH_TIMEOUT_MS);
  });
  try {
    const search = await Promise.race([getClient().then((yt) => yt.search(query, { type: "video" })), timeout]);
    const candidates: SearchResult[] = [];
    const seen = new Set<string>();
    for (const node of search.results ?? []) {
      const mapped = mapVideoNode(node);
      if (!mapped || seen.has(mapped.videoId)) continue;
      seen.add(mapped.videoId);
      candidates.push(mapped);
      if (candidates.length >= MAX_RESULTS) break;
    }
    // Hide videos that would be skipped on the main screen.
    const playable = await Promise.all(candidates.map((video) => isEmbeddable(video.videoId)));
    const results = candidates.filter((_, i) => playable[i]);
    if (cache.size > CACHE_MAX_QUERIES) cache.clear();
    cache.set(key, { at: Date.now(), results });
    return results;
  } finally {
    clearTimeout(timer);
  }
}
