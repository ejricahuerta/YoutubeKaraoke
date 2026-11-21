import { errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";
import { getHostTokenHash, getOrCreateGuestId } from "@/lib/server/auth";
import { isUuid, parseMoveRequest } from "@/lib/server/request-parsers";
import { moveQueueItem, removeQueueItem } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

type Params = { code: string; id: string };

/** Removes a song: the host can remove any, a guest only their own queued ones. */
export const DELETE = sessionRoute<Params>(async (_req, { code, params }) => {
  if (!isUuid(params.id)) return errorResponse("not_found", 404);
  return resultResponse(await removeQueueItem(code, params.id, await getHostTokenHash(code), await getOrCreateGuestId()));
});

/** Host only: moves a song to just after `afterId` (null = top of the queue). */
export const PATCH = sessionRoute<Params>(async (req, { code, params }) => {
  if (!isUuid(params.id)) return errorResponse("not_found", 404);
  const request = parseMoveRequest(await readJsonBody(req));
  if (!request) return errorResponse("invalid", 400);
  return resultResponse(await moveQueueItem(code, await getHostTokenHash(code), params.id, request.afterId));
});
