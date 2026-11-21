/** What to tell a person when something they asked for did not happen. */

const SESSION_ENDED = "This session has ended.";

const FAILURE_MESSAGES: Record<string, string> = {
  search_unavailable: "YouTube search isn't responding right now. Try again in a moment.",
  rate_limited: "Too many requests. Wait a few seconds and try again.",
  not_found: SESSION_ENDED,
  archived: SESSION_ENDED,
  queue_full: "The queue is full. Wait for a few songs to finish.",
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
