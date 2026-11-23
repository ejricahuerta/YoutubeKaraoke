import { resultResponse, sessionRoute } from "@/lib/server/api";
import { getHostTokenHash, getOrCreateGuestId } from "@/lib/server/auth";
import { claimRemote, freeRemote } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/** This phone takes the remote, if it has been freed; the first to ask gets it (migration 0012). */
export const POST = sessionRoute(async (_req, { code }) => resultResponse(await claimRemote(code, await getOrCreateGuestId())));

/** The main screen, or the remote itself, frees the remote for someone else to take. */
export const DELETE = sessionRoute(async (_req, { code }) =>
  resultResponse(await freeRemote(code, await getHostTokenHash(code), await getOrCreateGuestId())),
);
