import { NextResponse } from "next/server";
import { getHostHash, getOrCreateGuestId } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { errorResponse } from "@/lib/http";
import { getState } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await ctx.params).code);
  if (!code) return errorResponse("not_found", 404);
  const state = await getState(code, await getHostHash(code), await getOrCreateGuestId());
  if (!state) return errorResponse("not_found", 404);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
