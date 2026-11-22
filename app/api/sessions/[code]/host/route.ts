import { errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";
import { createHostToken, hashHostToken, setHostCookie } from "@/lib/server/auth";
import { isPhone } from "@/lib/server/device";
import { parseTakeOverRequest } from "@/lib/server/request-parsers";
import { takeOver } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/**
 * Opening a "move the main screen" link: { token }. This browser becomes the main screen
 * with a host token of its own, and the old one stops being host (migration 0013).
 * Phones are never the main screen (docs/adr/0007).
 */
export const POST = sessionRoute(async (req, { code }) => {
  if (isPhone(req.headers)) return errorResponse("forbidden", 403);
  const request = parseTakeOverRequest(await readJsonBody(req));
  if (!request) return errorResponse("invalid", 400);
  const token = createHostToken();
  const result = await takeOver(code, hashHostToken(request.token), hashHostToken(token));
  if (result === "ok") await setHostCookie(code, token);
  return resultResponse(result);
});
