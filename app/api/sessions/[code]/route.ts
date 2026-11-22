import { errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";
import { clearHostCookie, getHostTokenHash, getOrCreateGuestId } from "@/lib/server/auth";
import { parseSettingsRequest } from "@/lib/server/request-parsers";
import { endSession, getSessionState, setTakeTurns } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/** The session as this browser may see it. The host's polls double as the session's heartbeat. */
export const GET = sessionRoute(async (_req, { code }) => {
  const hostTokenHash = await getHostTokenHash(code);
  const state = await getSessionState(code, hostTokenHash, await getOrCreateGuestId());
  // A host cookie for a session that is gone, archived, or was replaced by a new one with the same code is dead weight.
  if (hostTokenHash && (!state || state.archived || !state.isHost)) await clearHostCookie(code);
  if (!state) return errorResponse("not_found", 404);
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
});

/** Host only: ends the session for everyone, for good. */
export const DELETE = sessionRoute(async (_req, { code }) => resultResponse(await endSession(code, await getHostTokenHash(code))));

/** Host only: changes the session's settings (whether singers take turns). */
export const PATCH = sessionRoute(async (req, { code }) => {
  const request = parseSettingsRequest(await readJsonBody(req));
  if (!request) return errorResponse("invalid", 400);
  return resultResponse(await setTakeTurns(code, await getHostTokenHash(code), request.takeTurns));
});
