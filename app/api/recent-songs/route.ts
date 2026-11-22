import { errorResponse } from "@/lib/server/api";
import { getRecentlyPlayedVideoIds } from "@/lib/server/session-store";
import { videoTitle } from "@/lib/server/youtube-search";
import type { RecentSong } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** The same for every visitor, so the CDN answers most start pages and the database sees about one call a minute. */
const CACHE_SECONDS = 60;
const STALE_SECONDS = 600;

/**
 * Songs sung lately in any session, for the start page (docs/adr/0019). Only video ids
 * come from the database; each title is YouTube's, and a video YouTube no longer plays is left out.
 */
export async function GET(): Promise<Response> {
  try {
    const videoIds = await getRecentlyPlayedVideoIds();
    const titles = await Promise.all(videoIds.map(videoTitle));
    const songs: RecentSong[] = videoIds.flatMap((videoId, i) => {
      const title = titles[i];
      return title ? [{ videoId, title }] : [];
    });
    return Response.json(
      { songs },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}` } },
    );
  } catch (err) {
    console.error("GET /api/recent-songs failed:", err);
    return errorResponse("server_error", 500);
  }
}
