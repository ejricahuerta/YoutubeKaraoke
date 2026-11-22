# 0020. The remote can be freed and taken by another phone

- Status: Accepted
- Date: 2026-11-22
- Amends: 0014 (the first guest to join is the remote)

## Context
ADR 0014 made the first phone to join a session its remote, with no way to change it.
If a guest scanned the code before the host's phone, they kept the remote all night;
if the remote's phone lost its cookies, the session had no remote. Nobody could see who
had it (issue #48).

## Decision
- `get_state` tells everyone who has the remote: `remote` is `unclaimed` (no phone has
  joined yet), `taken` or `free`, and `remoteName` is the remote's latest singer name,
  once it has added a song.
- The main screen, or the remote itself, can **free** it (`free_remote`,
  `DELETE /api/sessions/[code]/remote`). `sessions.remote_guest_id` becomes `''`: free,
  which joining does not claim, unlike `null`, which the first phone to join takes.
- While it is free, every phone shows **Use this phone as the remote**; the first to tap
  takes it (`claim_remote`, `POST .../remote`).
- The main screen shows this, with **Free the remote**, at the top of its **Edit queue**
  tab, next to **Take turns**: the night's settings sit with the queue they change, and
  the header stays short enough for a laptop. (Since [0023](0023-main-screen-controls.md),
  both are in the main screen's Settings menu, as the tabs are gone.)

## Why
- Picking a phone from a list would need the server to show guest ids or remember every
  phone's name; a phone's name is only known once it adds a song, and the person who
  should hold the remote may not have. "Free it, then tap on the right phone" needs
  neither and works for every phone.
- Guest ids stay private: nothing about them reaches other phones or the main screen.

## Consequences
- Between freeing and taking, any phone can tap first. At a party that is a shout across
  the room; if the wrong phone wins, free it again.
- A remote that has not added a song shows as "a phone".

## Revisit when
- Hosts want to hand it to a named person in one step: give phones a name before they add
  a song (sent with each state poll), then list them on the main screen.
