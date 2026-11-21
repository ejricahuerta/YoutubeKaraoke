import { getHostHash } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { errorResponse, readJson, resultResponse, UUID_PATTERN } from "@/lib/http";
import { playback } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Host only: { action: "play" | "pause" | "next", expectedItemId? }. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await ctx.params).code);
  if (!code) return errorResponse("not_found", 404);
  const body = await readJson(req);
  const action = body.action;
  if (action !== "play" && action !== "pause" && action !== "next") return errorResponse("invalid", 400);
  const expected = typeof body.expectedItemId === "string" && UUID_PATTERN.test(body.expectedItemId) ? body.expectedItemId : null;
  return resultResponse(await playback(code, await getHostHash(code), action, expected));
}
