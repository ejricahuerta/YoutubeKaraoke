import { normalizeSessionCode } from "@/lib/domain/session-code";
import { buildSearchQuery } from "@/lib/domain/video";
import { clientIp, errorResponse } from "@/lib/server/api";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { getSessionState } from "@/lib/server/session-store";
import { searchVideos } from "@/lib/server/youtube-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/search?code=&kind=karaoke|lyrics&q= : YouTube videos for a song or artist. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = normalizeSessionCode(url.searchParams.get("code"));
  const kind = url.searchParams.get("kind") === "lyrics" ? "lyrics" : "karaoke";
  const query = buildSearchQuery(url.searchParams.get("q") ?? "", kind);
  if (!query) return Response.json({ results: [] });
  if (!checkRateLimit(`search:${clientIp(req.headers)}`, RATE_LIMITS.search)) return errorResponse("rate_limited", 429);

  try {
    // Only people in a live session may search, so this is not an open proxy.
    const session = code ? await getSessionState(code, null, null) : null;
    if (!session || session.archived) return errorResponse("not_found", 404);
  } catch (err) {
    console.error("Search could not check the session:", err);
    return errorResponse("server_error", 500);
  }

  try {
    return Response.json({ results: await searchVideos(query) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("YouTube search failed:", err);
    return errorResponse("search_unavailable", 502);
  }
}
