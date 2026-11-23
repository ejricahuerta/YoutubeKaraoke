/** Shared plumbing for the route handlers in app/api: one response shape, one way to read input. */
import { normalizeSessionCode } from "@/lib/domain/session-code";
import type { ApiError, MutationResult } from "@/lib/domain/types";

const RESULT_STATUS: Record<MutationResult, number> = {
  ok: 200,
  stale: 200,
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  queue_full: 409,
  guest_limit: 409,
  archived: 410,
  main_screen_away: 409,
  main_screen_here: 409,
};

/** The HTTP answer for what a database function returned. */
export function resultResponse(result: MutationResult): Response {
  const status = RESULT_STATUS[result] ?? 500;
  return Response.json(status === 200 ? { ok: true, result } : { ok: false, error: result }, { status });
}

export function errorResponse(error: ApiError, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

/** The request's JSON object, or an empty object when the body is anything else. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The caller's address for rate limiting. Trusts the first x-forwarded-for entry, which is
 * right behind Vercel's proxy and good enough for a best-effort limit elsewhere.
 */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

type SessionRouteHandler<P> = (req: Request, route: { code: string; params: P }) => Promise<Response>;

/**
 * Wraps a route handler under /api/sessions/[code]: validates the code (404 if it cannot
 * be one) and turns anything thrown into a logged 500 with the usual JSON body.
 */
export function sessionRoute<P extends { code: string } = { code: string }>(handler: SessionRouteHandler<P>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const params = await ctx.params;
    const code = normalizeSessionCode(params.code);
    if (!code) return errorResponse("not_found", 404);
    try {
      return await handler(req, { code, params });
    } catch (err) {
      console.error(`${req.method} ${new URL(req.url).pathname} failed:`, err);
      return errorResponse("server_error", 500);
    }
  };
}
