import { errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";
import { getOrCreateGuestId } from "@/lib/server/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { parseAddSongRequest } from "@/lib/server/request-parsers";
import { addQueueItem } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/** Adds a song to the queue. Anyone who has the session code may add. */
export const POST = sessionRoute(async (req, { code }) => {
  const request = parseAddSongRequest(await readJsonBody(req));
  if (!request) return errorResponse("invalid", 400);
  const guestId = await getOrCreateGuestId();
  if (!checkRateLimit(`add:${guestId}`, RATE_LIMITS.addSong)) return errorResponse("rate_limited", 429);
  return resultResponse(await addQueueItem(code, guestId, request.name, request.video));
});
