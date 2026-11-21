import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const HOST_PREFIX = "kh_";
const GUEST_COOKIE = "kg";
const base = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newHostToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setHostCookie(code: string, token: string) {
  (await cookies()).set(HOST_PREFIX + code, token, { ...base, maxAge: 60 * 60 * 24 * 30 });
}

/** Hash of this browser's host token for the session, or null if it is not the host. */
export async function getHostHash(code: string): Promise<string | null> {
  const token = (await cookies()).get(HOST_PREFIX + code)?.value;
  return token ? hashToken(token) : null;
}

/** Codes of sessions this browser holds a host cookie for. */
export async function getHostedCodes(): Promise<string[]> {
  return (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith(HOST_PREFIX))
    .map((c) => c.name.slice(HOST_PREFIX.length));
}

/** Stable anonymous id for this browser; created on first use (route handlers only). */
export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  jar.set(GUEST_COOKIE, id, { ...base, maxAge: 60 * 60 * 24 * 365 });
  return id;
}
