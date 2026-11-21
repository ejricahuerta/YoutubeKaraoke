# 0003. Realtime sends "changed"; screens refetch

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `fa72792`)

## Context
Every screen should show a queue change within about a second. What a screen may
see differs per browser: `mine` and `isHost` depend on the caller's cookies.

## Decision
After each change, the database function calls `karaoke.notify`, which broadcasts
an empty `changed` event on the public Realtime channel `session:<CODE>`. Screens
subscribed to it refetch `GET /api/sessions/<CODE>`. They also refetch when the
tab regains focus and every 15 seconds (`lib/client/use-session-state.ts`).

## Why
- **The ping carries no data**, so the channel can be public: knowing a code lets
  you learn only that something changed.
- **One read path**: state always comes from `get_state`, which applies the
  per-caller view. Pushing rows would need a second implementation of that view
  in the browser, and Postgres Changes cannot work at all with the tables closed (0002).
- **Self-healing**: Realtime is treated as best effort (`notify` swallows its own
  errors). A missed ping costs at most 15 seconds, and the app works, slowly, with
  Realtime off.
- The host's 15-second poll doubles as the session's heartbeat (0008), so the poll
  is needed regardless.

## Consequences
- Each change costs one extra request per open screen. Fine for a room of people;
  wasteful for hundreds.
- Updates are whole-state replacements. There are no optimistic updates except the
  host's own play and pause.
- The channel name and event name appear in both SQL and TypeScript and must match.

## Revisit when
- Sessions regularly have enough screens that the refetch burst after each change
  is noticeable in database load.
- The state becomes large enough that refetching all of it per change is slow.
