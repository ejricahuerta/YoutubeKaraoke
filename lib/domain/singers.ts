/** Singer identity: a name, plus a colour and an initial derived from it on the client. */

export const SINGER_COLOR_COUNT = 8;
/** Songs one guest may have waiting at once. The database enforces it in add_item (migrations 0006, 0008, 0009). */
export const MAX_WAITING_SONGS = 3;
/** The waiting-songs limit applies only once this many people have songs on the list (migration 0008). */
export const PEOPLE_BEFORE_SONG_LIMIT = 3;

/** Matches the cut-off in the database's add_item function. */
export const SINGER_NAME_MAX_LENGTH = 40;

/** A stable colour slot (0-7) for a singer name, so the same person looks the same on every screen. */
export function singerColorIndex(name: string): number {
  const key = name.trim().toLowerCase();
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % SINGER_COLOR_COUNT;
}

export function singerInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

/** Trimmed and capped singer name; empty when there is none. */
export function normalizeSingerName(input: unknown): string {
  return typeof input === "string" ? input.trim().slice(0, SINGER_NAME_MAX_LENGTH) : "";
}
