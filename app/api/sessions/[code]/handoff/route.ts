import { resultResponse, sessionRoute } from "@/lib/server/api";
import { createHostToken, getOrCreateGuestId, hashHostToken } from "@/lib/server/auth";
import { startHandoff } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

/**
 * The remote, while the main screen is away: a one-time link to move the main screen to
 * another device (migration 0013). The database keeps only the secret's hash; the secret
 * goes back to the remote's phone once, to put in the link.
 */
export const POST = sessionRoute(async (_req, { code }) => {
  const token = createHostToken();
  const result = await startHandoff(code, await getOrCreateGuestId(), hashHostToken(token));
  return result === "ok" ? Response.json({ ok: true, result, token }) : resultResponse(result);
});
