# 0025. Sessions last an hour at most

- Status: Accepted
- Date: 2026-11-23
- Amends: 0008 (sessions archive when idle), 0022 (when the main screen is away)

## Context
Since 0022 a session ends when the main screen ends it, 15 minutes after the main screen
was last seen, or after 30 idle minutes. A busy session with the main screen open had no
end at all: it could run all night. The owner asked for every session to last an hour at
most.

## Decision
- A session ends **an hour after it started** (`sessions.created_at + max_length()`),
  whatever is playing or queued and however active everyone is. The hour is written once,
  in `karaoke.max_length()`.
- It is one more term in `closes_at()`, so `check_archived`, `cleanup` and the phones'
  countdown follow it with no other change. Ending this way is the same as any other
  ending: archived, final, deleted 24 hours later (0008).
- `get_state` reports `limitInSeconds`, the time left of the hour. In its last 10 minutes
  the main screen and every phone say so ("Sessions last an hour at most, so this one ends
  in about 9 min."), ahead of the idle and main-screen-away notices, since neither adding a
  song nor the main screen coming back puts it off.
- A song playing when the hour is up is cut off: the limit is a maximum, not a target.
- Sessions that were already over an hour old when migration 0016 shipped end the next
  time anyone touches them, or at the next cleanup.
- Moving the main screen (0022) does not restart the hour; starting a new session does.

## Why
- One rule, in the one place that already decides when a session ends, keeps the
  database the only authority (0002) and needs no scheduler (0008).
- Counting from `created_at` is simple to explain and cannot be extended by activity, so
  the hour is a real maximum.
- Warning everyone ten minutes ahead, with the reason, means the end is not a surprise;
  the same 10 minutes as the idle warning keeps one rhythm.

## Consequences
- A party longer than an hour has to start a new session, with a new code and an empty
  queue: songs still waiting are lost, and guests must scan the new QR code.
- The last song of the hour can stop mid-way.
- The policies say a session closes an hour after it started (Terms, Privacy Policy).

## Revisit when
- Hosts ask to carry on past the hour, or to keep their queue into a new session: let the
  main screen start a follow-on session that copies the queue, or lengthen `max_length()`.
- Cutting off the last song annoys people: let the playing song finish before archiving.
