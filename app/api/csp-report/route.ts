import { clientIp } from "@/lib/server/api";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { summarizeCspReport } from "@/lib/server/security-headers";

export const dynamic = "force-dynamic";

/**
 * Browsers post here what the report-only Content-Security-Policy would have blocked.
 * Each report becomes one line in the server log; read them in Vercel's runtime logs.
 * Always 204: a browser does nothing with the answer.
 */
export async function POST(req: Request) {
  if (checkRateLimit(`csp:${clientIp(req.headers)}`, RATE_LIMITS.cspReport)) {
    const body = await req.json().catch(() => null);
    const violation = summarizeCspReport(body);
    if (violation) console.warn("CSP report-only violation", violation);
  }
  return new Response(null, { status: 204 });
}
