import { clientIp, errorResponse } from "@/lib/server/api";
import { createHostToken, hashHostToken, setHostCookie } from "@/lib/server/auth";
import { isPhone } from "@/lib/server/device";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { createSession } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

const seeOther = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

/** Starts a session, makes this browser its host, and sends it to the main screen. */
export async function POST(req: Request) {
  // Sessions are started from the big screen, never from a phone.
  if (isPhone(req.headers)) return seeOther("/");
  if (!checkRateLimit(`create:${clientIp(req.headers)}`, RATE_LIMITS.createSession)) return errorResponse("rate_limited", 429);
  const token = createHostToken();
  const code = await createSession(hashHostToken(token));
  await setHostCookie(code, token);
  // The start page posts a plain form and follows the redirect; scripts can ask for JSON.
  if (req.headers.get("accept")?.includes("application/json")) return Response.json({ ok: true, code });
  return seeOther(`/s/${code}`);
}
