import { getHostHash, getOrCreateGuestId } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { errorResponse, readJson, resultResponse, UUID_PATTERN } from "@/lib/http";
import { moveItem, removeItem } from "@/lib/sessions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string; id: string }> };

/** Removes a song: the host can remove any, a guest only their own queued ones. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { code: rawCode, id } = await ctx.params;
  const code = normalizeCode(rawCode);
  if (!code || !UUID_PATTERN.test(id)) return errorResponse("not_found", 404);
  return resultResponse(await removeItem(code, id, await getHostHash(code), await getOrCreateGuestId()));
}

/** Host only: moves a song to just after `afterId` (null = top of the queue). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { code: rawCode, id } = await ctx.params;
  const code = normalizeCode(rawCode);
  if (!code || !UUID_PATTERN.test(id)) return errorResponse("not_found", 404);
  const body = await readJson(req);
  const afterId = body.afterId ?? null;
  if (afterId !== null && (typeof afterId !== "string" || !UUID_PATTERN.test(afterId))) {
    return errorResponse("invalid", 400);
  }
  return resultResponse(await moveItem(code, await getHostHash(code), id, afterId as string | null));
}
