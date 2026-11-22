/** What to tell a person when something they asked for did not happen. */
import { MAX_WAITING_SONGS } from "./singers";

const SESSION_ENDED = "This session has ended.";

const FAILURE_MESSAGES: Record<string, string> = {
  search_unavailable: "YouTube search isn't responding right now. Try again in a moment.",
  rate_limited: "Too many requests. Wait a few seconds and try again.",
  not_found: SESSION_ENDED,
  archived: SESSION_ENDED,
  queue_full: "The queue is full. Wait for a few songs to finish.",
  guest_limit: `You already have ${MAX_WAITING_SONGS} songs waiting. Add another once one is sung.`,
  forbidden: "Only the main screen can do that.",
  main_screen_away: "The main screen is away, so nothing can play. Open it again, or move it to another screen.",
  main_screen_here: "The main screen is back, so it can't be moved.",
  network_error: "You seem to be offline. Check your connection and try again.",
};

/** True unless the change happened. "stale" counts as done: someone else got there first. */
export function isFailure(outcome: string): boolean {
  return outcome !== "ok" && outcome !== "stale";
}

/** Words for an API result code; `fallback` names what the person was trying to do. */
export function failureMessage(outcome: string, fallback: string): string {
  return FAILURE_MESSAGES[outcome] ?? fallback;
}

const START_ERRORS: Record<string, string> = {
  unavailable: "We couldn't start a session just now. Try again in a moment.",
  slow_down: "That's a lot of new sessions. Wait a minute, then try again.",
};

/** The notice for `/?error=…` after a failed "Start a session"; null for anything unknown. */
export function startErrorMessage(code: string | undefined): string | null {
  return (code && Object.hasOwn(START_ERRORS, code) ? START_ERRORS[code] : null) ?? null;
}

/** "about 9 min" or "under a minute": the time left before a session ends. */
function timeLeft(seconds: number): string {
  return seconds < 60 ? "under a minute" : `about ${Math.ceil(seconds / 60)} min`;
}

/** For guests while the main screen is away (the database decides when, migration 0014); null otherwise. */
export function mainScreenGoneNotice(state: { mainScreenAway?: boolean; closesInSeconds?: number | null }): string | null {
  if (!state.mainScreenAway || state.closesInSeconds == null) return null;
  return `The main screen is away, so nothing is playing. If it doesn't come back, this session ends in ${timeLeft(state.closesInSeconds)}.`;
}

/** Warn the main screen this long before an idle session (nothing playing or queued) ends. */
const IDLE_NOTICE_SECONDS = 10 * 60;

/** For the main screen when nothing is playing or queued and the session ends soon; null otherwise. */
export function idleNotice({ hasSongs, closesInSeconds }: { hasSongs: boolean; closesInSeconds: number | null }): string | null {
  if (hasSongs || closesInSeconds == null || closesInSeconds > IDLE_NOTICE_SECONDS) return null;
  return `Nothing's queued. This session ends in ${timeLeft(closesInSeconds)} unless someone adds a song.`;
}
