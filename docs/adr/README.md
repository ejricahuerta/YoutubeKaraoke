# Decision records

Each file records one choice: what we decided, why, what it costs, and **what
would make it the wrong choice**. Read the "Revisit when" section before changing
the thing a record covers. If its conditions have come true, the decision is free
to change; write a new record that supersedes it.

Records 0001 to 0010 were written on 2026-11-21, after the fact, from the code,
its comments and the commit history. They describe decisions already in the code
at that point. Later records are written when the decision is made.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-nextjs-monolith.md) | One Next.js app serves pages and API | Accepted |
| [0002](0002-database-functions-are-the-only-data-access.md) | All rules live in Postgres functions; tables are closed | Accepted, amended by 0026 |
| [0003](0003-realtime-ping-then-refetch.md) | Realtime sends "changed"; screens refetch | Accepted |
| [0004](0004-anonymous-cookie-identity.md) | No accounts: host token and guest id cookies | Accepted, amended by 0026 |
| [0005](0005-youtube-iframe-player.md) | YouTube IFrame player with our own controls | Superseded by 0018 |
| [0006](0006-keyless-youtube-search.md) | Keyless search through youtubei.js, behind one module | Accepted |
| [0007](0007-phones-are-guests.md) | Phones only ever get the guest view | Accepted |
| [0008](0008-archive-on-access.md) | Sessions archive after 15 idle minutes, checked on access | Accepted, amended by 0022 and 0025 |
| [0009](0009-tv-scale-grid.md) | Host screen drawn on a scaling 1920 × 1080 grid | Accepted |
| [0010](0010-in-memory-limits-and-caches.md) | Rate limits and caches live in server memory | Accepted |
| [0011](0011-layered-lib.md) | `lib` split into domain, server and client, enforced by lint | Accepted |
| [0012](0012-testing-strategy.md) | Test-first; pure logic unit-tested, database tested in Postgres | Accepted |
| [0013](0013-optional-youtube-api-fallback.md) | Official YouTube API as a fallback when a key is set | Accepted |
| [0014](0014-first-guest-is-the-remote.md) | The first guest to join is the remote | Accepted |
| [0015](0015-migrate-on-production-build.md) | Production builds apply pending migrations first | Accepted |
| [0016](0016-singers-take-turns.md) | Singers take turns, one song per round | Accepted |
| [0017](0017-one-room-per-browser.md) | One room per browser, shared by its tabs | Accepted |
| [0018](0018-privacy-enhanced-youtube-player.md) | YouTube's privacy-enhanced player, with our own controls | Accepted |
| [0019](0019-integration-tests-in-docker.md) | Test the built app against a real database in Docker | Accepted |
| [0020](0020-hand-over-the-remote.md) | The remote can be freed and taken by another phone | Accepted |
| [0021](0021-recently-sung-songs-on-the-start-page.md) | Songs sung lately are shown on the start page | Accepted |
| [0022](0022-when-the-main-screen-is-away.md) | When the main screen is away: pause, end after 15 minutes, move it | Accepted, amended by 0025 |
| [0023](0023-main-screen-controls.md) | Main screen: four buttons, a Settings menu, confirmations | Accepted, extended by 0024 |
| [0024](0024-main-screen-microphone.md) | The main screen's microphone: echo, reverb, test mic | Accepted |
| [0025](0025-sessions-last-an-hour.md) | Sessions last an hour at most, then a 15-minute wait | Accepted, amended by 0026 |
| [0026](0026-server-only-session-start.md) | Signed guest cookie, a wait per network, and only the server starts sessions | Accepted |

## Template

```markdown
# NNNN. Title in plain words

- Status: Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What situation forced a choice.

## Decision
What we do.

## Why
The reasons, and the alternatives that lost.

## Consequences
What this costs or constrains.

## Revisit when
Concrete signs that this is no longer the right call.
```
