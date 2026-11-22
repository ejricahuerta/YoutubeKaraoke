/**
 * Who is asking, without accounts (docs/adr/0004). The browser that starts a session holds
 * a random host token for it; every browser holds an anonymous guest id. Both are cookies.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { isUuid } from "./request-parsers";

/** Cookie names are short on purpose: one host cookie per session rides on every request. */
const HOST_COOKIE_PREFIX = "kh_";
const GUEST_COOKIE = "kg";
const HOST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

/** The database stores only this hash, so reading the table does not hand out host rights. */
export function hashHostToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createHostToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setHostCookie(code: string, token: string) {
  (await cookies()).set(HOST_COOKIE_PREFIX + code, token, { ...COOKIE_OPTIONS, maxAge: HOST_COOKIE_MAX_AGE });
}

/** Forgets host rights for a session that is over, so its cookie stops riding on every request. */
export async function clearHostCookie(code: string) {
  (await cookies()).delete(HOST_COOKIE_PREFIX + code);
}

/** Hash of this browser's host token for the session, or null if it is not the host. */
export async function getHostTokenHash(code: string): Promise<string | null> {
  const token = (await cookies()).get(HOST_COOKIE_PREFIX + code)?.value;
  return token ? hashHostToken(token) : null;
}

/** Codes of sessions this browser holds a host cookie for. */
export async function getHostedSessionCodes(): Promise<string[]> {
  return (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith(HOST_COOKIE_PREFIX))
    .map((c) => c.name.slice(HOST_COOKIE_PREFIX.length));
}

/** Stable anonymous id for this browser; created on first use (route handlers only). */
export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (isUuid(existing)) return existing;
  const id = randomUUID();
  jar.set(GUEST_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: GUEST_COOKIE_MAX_AGE });
  return id;
}
