/**
 * Who is asking, without accounts (docs/adr/0004). The browser that starts a session holds
 * a random host token for it; every browser holds an anonymous guest id. Both are cookies.
 * The guest id is signed with SESSION_SECRET, so a browser cannot change it (ADR 0026); the
 * host token needs no signature, since only its hash is stored and any other value matches nothing.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { networkOf } from "@/lib/domain/network";
import { isUuid } from "./request-parsers";

/** Cookie names are short on purpose: one host cookie per session rides on every request. */
/** Exported for the cookie policy's test: lib/domain/legal.ts lists each with this lifetime. */
export const HOST_COOKIE_PREFIX = "kh_";
export const GUEST_COOKIE = "kg";
/** Seconds. */
export const HOST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** Seconds. */
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

/** Shorter secrets are refused: the guest cookie's signature is only as strong as this. */
export const SESSION_SECRET_MIN_LENGTH = 32;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`SESSION_SECRET is not set, or is shorter than ${SESSION_SECRET_MIN_LENGTH} characters. See .env.example.`);
  }
  return secret;
}

/** A keyed hash of `value`; `purpose` keeps a signature for one use from passing as another. */
function keyedHash(purpose: string, value: string): string {
  return createHmac("sha256", sessionSecret()).update(`${purpose}:${value}`).digest("base64url");
}

/** The guest id in a cookie value `<id>.<signature>`, or null if it is not one this server signed. */
function readGuestCookie(value: string | undefined): string | null {
  const parts = (value ?? "").split(".");
  if (parts.length !== 2 || !isUuid(parts[0])) return null;
  const [id, signature] = parts;
  const expected = Buffer.from(keyedHash("guest", id));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/**
 * Names the network a request came from without storing its address: a keyed hash of the
 * address's network (lib/domain/network.ts), so it cannot be reversed by trying every address.
 */
export function hashNetwork(ip: string): string {
  return keyedHash("network", networkOf(ip));
}

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

/**
 * Stable anonymous id for this browser; created on first use (route handlers only). A cookie
 * that was edited, forged or set before signing began gets a new id, as if there were none.
 */
export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = readGuestCookie(jar.get(GUEST_COOKIE)?.value);
  if (existing) return existing;
  const id = randomUUID();
  jar.set(GUEST_COOKIE, `${id}.${keyedHash("guest", id)}`, { ...COOKIE_OPTIONS, maxAge: GUEST_COOKIE_MAX_AGE });
  return id;
}
