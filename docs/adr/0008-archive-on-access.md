# 0008. Sessions archive after 15 idle minutes, checked on access

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `0c680a4`)

## Context
Sessions are created freely and nobody ends them: people close the laptop and go
home. Without a rule, codes and rows pile up for ever and an old code could be
reused by a stranger.

## Decision
- A session is **archived** once 15 minutes pass with no activity. Activity is the
  host screen being open (its state poll updates `last_active_at`, at most once a
  minute), or anyone adding a song or using a control. A guest merely looking is
  not activity.
- Archived is final. Every database entry point reports `archived` and refuses changes.
- Staleness is **checked when the session is touched** (`check_archived`), not by a
  timer, so the answer is exact with no scheduler.
- `cleanup()` archives idle sessions nobody touched and deletes sessions archived
  more than 24 hours ago, with their songs. It runs on every session creation, and
  every 5 minutes through `pg_cron` where that extension is already enabled.

## Why
- Tying life to the open host screen matches what a session is: a long song never
  ends it, closing the screen does.
- Checking on access needs no infrastructure and cannot be late: the first request
  after the deadline sees the session archived.
- Running cleanup on creation means the table is bounded even on a project
  without `pg_cron`.
- Keeping archives 24 hours lets screens left open say "this session has ended"
  instead of "not found".

## Consequences
- A host who steps away for 15 minutes with the screen closed loses the session
  and its queue, with no undo.
- A sleeping laptop stops polling, so a long sleep ends the session.
- The 15-minute value is written twice in SQL (`check_archived`, `cleanup`) and
  twice in user-facing text; they must be changed together.

## Revisit when
- Hosts lose sessions they wanted to keep (ask for pause, or a longer window).
- Session creation becomes frequent enough that running `cleanup()` inside it is slow.
