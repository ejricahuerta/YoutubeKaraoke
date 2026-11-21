import { errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";
import { getHostTokenHash } from "@/lib/server/auth";
import { parsePlaybackRequest } from "@/lib/server/request-parsers";
import { updatePlayback } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/** Host only: { action: "play" | "pause" | "next", expectedItemId? }. */
export const POST = sessionRoute(async (req, { code }) => {
  const request = parsePlaybackRequest(await readJsonBody(req));
  if (!request) return errorResponse("invalid", 400);
  return resultResponse(await updatePlayback(code, await getHostTokenHash(code), request.action, request.expectedItemId));
});
