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
  // The start page posts a plain form and follows redirects; scripts can ask for JSON.
  const wantsJson = req.headers.get("accept")?.includes("application/json") ?? false;

  if (!checkRateLimit(`create:${clientIp(req.headers)}`, RATE_LIMITS.createSession)) {
    return wantsJson ? errorResponse("rate_limited", 429) : seeOther("/?error=slow_down");
  }
  let code: string;
  try {
    const token = createHostToken();
    code = await createSession(hashHostToken(token));
    await setHostCookie(code, token);
  } catch (err) {
    console.error("Could not start a session:", err);
    return wantsJson ? errorResponse("server_error", 500) : seeOther("/?error=unavailable");
  }
  return wantsJson ? Response.json({ ok: true, code }) : seeOther(`/s/${code}`);
}
