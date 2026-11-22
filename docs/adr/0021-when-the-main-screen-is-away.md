# 0021. When the main screen is away

- Status: Accepted
- Date: 2026-11-22
- Amends: 0008 (sessions archive after 15 idle minutes)

## Context
A session ended 15 minutes after its last activity, and guests' actions counted. So a
session could linger for hours with no main screen and nothing playing, and its "ends in"
countdown kept jumping back. Phones still said "Playing", and the remote's buttons did
nothing visible. If the main screen's browser could not come back (closed, cookies
cleared, a dead laptop), nobody could be the main screen again. And an open main screen
with nothing to play kept a session alive forever. The owner chose each rule below.

## Decision
- **Heartbeat, not activity.** The main screen's poll updates `host_seen_at` only. Real
  activity (adding, playing, skipping, reordering) updates `last_active_at`.
- **Away after 150 seconds** without a heartbeat (`away_after()`; the poll is written
  once a minute, so up to about 75 seconds is normal). Then `get_state` reports
  `mainScreenAway`, playback is marked paused (and stays paused when the screen returns),
  and phones cannot play, pause or skip (`main_screen_away`). Guests can still add songs.
- **A session ends** at whichever comes first, decided in one place, `closes_at()`, for
  `check_archived`, `cleanup` and the phones' countdown:
  - 15 minutes after the main screen was last seen (`idle_limit()`), whatever guests do;
  - 30 minutes after the last activity with nothing playing and nothing queued
    (`idle_after()`), even with the main screen open. The main screen warns 10 minutes ahead.
- **Moving the main screen.** While it is away, the remote can ask for a one-time link
  (`POST .../handoff`, `start_handoff`). It works once, for 10 minutes, and only the hash
  of its secret is stored. A big screen that opens it (`/s/CODE?takeover=…`, then
  `POST .../host`, `take_over`) gets a host token of its own and becomes the main screen;
  the old one stops being host. If the main screen came back meanwhile, the link is
  refused (`main_screen_here`). Phones never take over (0007).

## Why
- The main screen is what makes a session a party: without it nothing can play, so its
  absence, not guests' activity, should decide how long a session lives.
- Saying "away" and pausing is honest; a remote pressing play on nothing was confusing.
- Moving the main screen is limited to the remote, and to when the main screen is away,
  so nobody can take over a screen that is in use. The link's secret is as strong as a
  host token (32 random bytes) and never stored.

## Consequences
- A main screen asleep or closed for over 15 minutes ends the session even mid-party;
  0014's wake lock and the phones' countdown are there to prevent and warn about it.
- A paused-but-queued session with the main screen open never idles out: songs waiting
  count as not idle.
- Without a remote (it was freed and nobody took it), nobody can move the main screen.

## Revisit when
- Parties lose sessions to a laptop sleeping for 15 minutes: lengthen `idle_limit()`.
- Hosts want to move a main screen that is still there (to a bigger TV): let the main
  screen itself make the link.
