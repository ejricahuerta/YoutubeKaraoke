const WINDOW_MS = 60_000;
const MAX_KEYS = 5000;
const hits = new Map<string, number[]>();

/** Calls allowed per minute, per caller. */
export const RATE_LIMITS = { search: 40, createSession: 10, addSong: 30 } as const;

/**
 * True when this call may go ahead; false when the key is over its limit for the last minute.
 * Best effort: the counts live in this server instance's memory (see docs/adr/0010).
 */
export function checkRateLimit(key: string, limit: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.clear();
  return true;
}
