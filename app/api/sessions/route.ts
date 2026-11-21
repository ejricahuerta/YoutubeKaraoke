import { NextResponse } from "next/server";
import { hashToken, newHostToken, setHostCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { allow } from "@/lib/rate-limit";
import { createSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Starts a session, makes this browser its host, and sends it to the main screen. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`create:${ip}`, 10)) return errorResponse("rate_limited", 429);
  const token = newHostToken();
  const code = await createSession(hashToken(token));
  await setHostCookie(code, token);
  if (req.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true, code });
  }
  return new NextResponse(null, { status: 303, headers: { Location: `/s/${code}` } });
}
