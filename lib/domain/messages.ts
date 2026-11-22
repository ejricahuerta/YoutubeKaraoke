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

/**
 * After how long without a poll from the main screen guests are warned. The main screen
 * polls every 15 seconds but its poll is only written once a minute, so a gap of up to
 * about 75 seconds is normal.
 */
const HOST_AWAY_NOTICE_SECONDS = 150;

/** A warning for guests when the main screen has gone; null while it is there or unknown. */
export function mainScreenGoneNotice(state: { hostAwaySeconds?: number | null; closesInSeconds?: number | null }): string | null {
  const { hostAwaySeconds, closesInSeconds } = state;
  if (hostAwaySeconds == null || closesInSeconds == null || hostAwaySeconds < HOST_AWAY_NOTICE_SECONDS) return null;
  const left = closesInSeconds < 60 ? "under a minute" : `about ${Math.ceil(closesInSeconds / 60)} min`;
  return `The main screen seems to be closed, so nothing will play. If it stays closed, this session ends in ${left}.`;
}
