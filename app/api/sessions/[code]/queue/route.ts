import { getOrCreateGuestId } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { thumbnailFor, VIDEO_ID_PATTERN } from "@/lib/format";
import { errorResponse, readJson, resultResponse } from "@/lib/http";
import { allow } from "@/lib/rate-limit";
import { addItem } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Adds a song to the queue. Anyone who has the session code may add. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await ctx.params).code);
  if (!code) return errorResponse("not_found", 404);
  const body = await readJson(req);
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!VIDEO_ID_PATTERN.test(videoId) || !title) return errorResponse("invalid", 400);
  const guestId = await getOrCreateGuestId();
  if (!allow(`add:${guestId}`, 30)) return errorResponse("rate_limited", 429);
  const result = await addItem(code, guestId, typeof body.name === "string" ? body.name : "", {
    videoId,
    title,
    channel: typeof body.channel === "string" ? body.channel : "",
    thumbnailUrl: thumbnailFor(videoId), // never trust a client-supplied image URL
    durationSeconds: Number.isFinite(body.durationSeconds) ? Math.floor(body.durationSeconds as number) : 0,
  });
  return resultResponse(result);
}
