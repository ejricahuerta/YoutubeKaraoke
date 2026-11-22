# 0007. Phones only ever get the guest view

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `d2a30e2`)

## Context
The host screen is built for a large display. On a phone it is unusable, and a
guest who scans the wrong link or opens the start page could start a session by
accident and wonder why nothing plays on the TV.

## Decision
The server detects phones from the `Sec-CH-UA-Mobile` and `User-Agent` headers
(`lib/server/device.ts`). A phone:
- sees only the "enter a code" form on the start page,
- is redirected from `/s/CODE` to `/join/CODE`,
- is sent back to the start page if it posts to create a session.

Tablets count as big screens.

## Why
- One rule keeps every guest on the one view designed for them, whatever link
  they were sent.
- Doing it on the server means the phone never downloads or flashes the host screen.
- Tablets are large enough to host from, and people do.

## Consequences
- User-agent detection is a heuristic. A phone in "desktop site" mode gets the
  host screen, and an unusual device may be misjudged.
- You cannot host from a phone, even on purpose (casting a phone to a TV, say).
- You cannot use a phone as a remote control for the host screen.

## Update, 2026-11-22
The first guest to join a session is now its remote and can control playback and the
queue from their phone: see 0014.

## Revisit when
- People ask to host from a phone, or to control playback from one.
- A phone-sized host layout is designed.
