const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Best-effort, per-instance sliding window. Returns false when over the limit. */
export function allow(key: string, limit: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
