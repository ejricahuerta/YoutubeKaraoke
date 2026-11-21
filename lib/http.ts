import { NextResponse } from "next/server";
import type { MutationResult } from "./sessions";

const STATUS: Record<MutationResult, number> = {
  ok: 200,
  stale: 200,
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  queue_full: 409,
};

export function resultResponse(result: MutationResult) {
  const status = STATUS[result] ?? 500;
  return NextResponse.json(status === 200 ? { ok: true, result } : { ok: false, error: result }, { status });
}

export function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
