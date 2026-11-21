# 0002. All rules live in Postgres functions; tables are closed

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `fa72792`)

## Context
Several browsers change one queue at the same time: two guests add, the host
skips, the video ends and fires "next" twice. Each change must check who is
asking and leave the queue consistent. The app also has no secret it can safely
hold: `NEXT_PUBLIC_` keys are public by definition.

## Decision
- Everything lives in a dedicated `karaoke` schema.
- Both tables have row level security **on with no policies**, so no API role can
  read or write them directly.
- Six `security definer` functions (`create_session`, `get_state`, `add_item`,
  `remove_item`, `move_item`, `playback`) are the only way in. Each locks the
  session row, checks the host token hash or guest id itself, makes the change,
  and returns a result code.
- The server uses only the publishable (anon) key. There is no service-role key
  anywhere.
- `lib/server/session-store.ts` is the only file that calls these functions.

## Why
- **Atomic and race-free**: one function call is one transaction with the session
  row locked (`for update`), so "is this still the current song?" and "advance"
  cannot interleave. `playback(next, expected_item_id)` answers `stale` when a
  repeat arrives, which is how a double-fired "ended" event skips only one song.
- **One place for permissions**: the rule "guests remove only their own queued
  songs" exists once, next to the data, and holds no matter which client calls.
- **No secret to leak**: with tables closed and functions checking the caller, the
  publishable key grants nothing by itself. Losing it costs nothing.
- Alternatives that lost: RLS policies with direct table access (cannot express
  "advance the queue" atomically, and identity is a cookie the database cannot
  see); rules in route handlers with a service key (a secret to protect, and
  races between two serverless instances).

## Consequences
- Business logic is written in PL/pgSQL, which is harder to read and refactor than
  TypeScript. It is tested by `supabase/tests` against a real Postgres.
- Changing a rule means a new migration, applied by hand in the SQL editor.
- The `karaoke` schema must be added to the project's exposed schemas once.
- Route handlers must stay thin; a permission check in TypeScript would be a
  second, weaker copy of the rule.

## Revisit when
- The functions grow past what one person can hold in their head, or a rule needs
  data the database cannot reach (an external service, for instance).
- We adopt real user accounts (Supabase Auth), which would make RLS policies on
  `auth.uid()` a simpler way to say who may do what.
