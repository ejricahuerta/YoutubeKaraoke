/** Singer identity (colour and initial) and wait-time estimates, all derived on the client. */

export const SINGER_COLOR_COUNT = 8;

/** A stable colour slot (0-7) for a singer name, so the same person looks the same on every screen. */
export function singerIndex(name: string): number {
  const key = name.trim().toLowerCase();
  let hash = 2166136261;
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

/** Used when YouTube gave no duration for a video. */
const DEFAULT_SONG_SECONDS = 210;

type Timed = { durationSeconds: number };

function songSeconds(item: Timed): number {
  return item.durationSeconds > 0 ? item.durationSeconds : DEFAULT_SONG_SECONDS;
}

/**
 * Seconds until queue[index] starts. Pass queue.length for the whole queue.
 * `elapsed` is how far into the current song we are; when unknown, assume halfway.
 */
export function waitSeconds(current: Timed | null, queue: Timed[], index: number, elapsed?: number): number {
  let total = 0;
  if (current) {
    const length = songSeconds(current);
    total += elapsed === undefined ? length / 2 : Math.max(0, length - elapsed);
  }
  for (let i = 0; i < Math.min(index, queue.length); i++) total += songSeconds(queue[i]);
  return total;
}

/** "about 12 min": the way people say it, never a clock time. */
export function formatWait(seconds: number): string {
  if (seconds < 90) return "any minute now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} hr ${rest} min` : `about ${hours} hr`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function countSongs(n: number): string {
  return n === 1 ? "1 song" : `${n} songs`;
}
