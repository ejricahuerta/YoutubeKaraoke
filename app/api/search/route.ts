import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/codes";
import { buildSearchQuery } from "@/lib/format";
import { errorResponse } from "@/lib/http";
import { allow } from "@/lib/rate-limit";
import { getState } from "@/lib/sessions";
import { searchVideos } from "@/lib/youtube-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = normalizeCode(url.searchParams.get("code"));
  const kind = url.searchParams.get("kind") === "lyrics" ? "lyrics" : "karaoke";
  const query = buildSearchQuery((url.searchParams.get("q") ?? "").slice(0, 120), kind);
  if (!query) return NextResponse.json({ results: [] });

  // Only people in a live session may search, so this is not an open proxy.
  const session = code ? await getState(code, null, null) : null;
  if (!session || session.archived) return errorResponse("not_found", 404);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`search:${ip}`, 40)) return errorResponse("rate_limited", 429);

  try {
    return NextResponse.json({ results: await searchVideos(query) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("YouTube search failed:", err);
    return errorResponse("search_unavailable", 502);
  }
}
