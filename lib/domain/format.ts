/** Wording for numbers the room reads: song lengths, waits, places in line. */

/** "3:05" or "1:02:05"; empty when the length is unknown. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
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
