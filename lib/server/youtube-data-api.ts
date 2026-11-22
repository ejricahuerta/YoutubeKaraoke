/**
 * Search through YouTube's official Data API v3. Used only as a fallback when keyless
 * search fails and YOUTUBE_API_KEY is set (docs/adr/0013). It answers in the same shape
 * as keyless search, so nothing else needs to know which one ran.
 *
 * Quota: a search costs 101 units of the default 10,000 a day (search 100 + videos 1),
 * so about 99 searches a day. Results are cached by the caller.
 */
import type { SearchResult } from "@/lib/domain/types";
import { isVideoId, thumbnailUrl } from "@/lib/domain/video";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 20;
const TIMEOUT_MS = 6000;

/** Seconds in an ISO 8601 duration such as "PT4M13S"; 0 for live streams and anything else. */
export function parseIsoDuration(value: string | undefined): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

type VideoResource = {
  id?: string;
  snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean };
};

/** One item from videos.list as a search result; null for anything that could not play here. */
export function mapDataApiVideo(raw: unknown): SearchResult | null {
  const item = raw as VideoResource | null;
  if (!item || !isVideoId(item.id)) return null;
  if (item.snippet?.liveBroadcastContent !== "none" || item.status?.embeddable !== true) return null;
  const durationSeconds = parseIsoDuration(item.contentDetails?.duration);
  const title = (item.snippet.title ?? "").trim();
  if (!(durationSeconds > 0) || !title) return null;
  return { videoId: item.id, title, channel: (item.snippet.channelTitle ?? "").trim(), thumbnailUrl: thumbnailUrl(item.id), durationSeconds };
}

async function get(path: string, params: Record<string, string>): Promise<{ items?: unknown[] }> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  // The URL holds the key, so the error names only the endpoint and status.
  if (!res.ok) throw new Error(`YouTube Data API ${path} answered ${res.status}`);
  return res.json();
}

/** Videos for a query: search.list for embeddable videos, then videos.list for lengths and live status. */
export async function searchWithDataApi(query: string, apiKey: string): Promise<SearchResult[]> {
  const found = await get("search", {
    part: "id", q: query, type: "video", videoEmbeddable: "true", maxResults: String(MAX_RESULTS), key: apiKey,
  });
  const ids = (found.items ?? [])
    .map((item) => (item as { id?: { videoId?: string } }).id?.videoId)
    .filter((id): id is string => isVideoId(id));
  if (ids.length === 0) return [];

  const details = await get("videos", { part: "snippet,contentDetails,status", id: ids.join(","), key: apiKey });
  const byId = new Map((details.items ?? []).map((item) => [(item as VideoResource).id, item]));
  return ids.map((id) => mapDataApiVideo(byId.get(id))).filter((video): video is SearchResult => video !== null);
}
