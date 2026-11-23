import { clientIp, errorResponse } from "@/lib/server/api";
import { createHostToken, getOrCreateGuestId, hashHostToken, hashNetwork, setHostCookie } from "@/lib/server/auth";
import { isPhone } from "@/lib/server/device";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { createSession, type StartedSession } from "@/lib/server/session-store";

export const dynamic = "force-dynamic";

const SECONDS_PER_MINUTE = 60;

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
  let started: StartedSession;
  const token = createHostToken();
  try {
    started = await createSession(hashHostToken(token), await getOrCreateGuestId(), hashNetwork(clientIp(req.headers)));
    if ("code" in started) await setHostCookie(started.code, token);
  } catch (err) {
    console.error("Could not start a session:", err);
    return wantsJson ? errorResponse("server_error", 500) : seeOther("/?error=unavailable");
  }
  // This browser's or this network's last session ran its full hour: the next starts 15 minutes after (ADR 0025, 0026).
  if ("waitSeconds" in started) {
    const { waitSeconds } = started;
    return wantsJson
      ? Response.json({ ok: false, error: "too_soon", waitSeconds }, { status: 429 })
      : seeOther(`/?error=too_soon&minutes=${Math.ceil(waitSeconds / SECONDS_PER_MINUTE)}`);
  }
  return wantsJson ? Response.json({ ok: true, code: started.code }) : seeOther(`/s/${started.code}`);
}
