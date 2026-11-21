import { errorResponse, sessionRoute } from "@/lib/server/api";
import { getHostTokenHash, getOrCreateGuestId } from "@/lib/server/auth";
import { getSessionState } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/** The session as this browser may see it. The host's polls double as the session's heartbeat. */
export const GET = sessionRoute(async (_req, { code }) => {
  const state = await getSessionState(code, await getHostTokenHash(code), await getOrCreateGuestId());
  if (!state) return errorResponse("not_found", 404);
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
});
