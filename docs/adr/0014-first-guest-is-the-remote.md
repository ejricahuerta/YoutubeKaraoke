# 0014. The first guest to join is the remote

- Status: Accepted, amended by 0019 (the remote can be freed and taken by another phone)
- Date: 2026-11-22
- Amends: 0004 (one browser holds host rights), 0007 (phones are only ever guests)

## Context
The main screen is often a TV across the room. Pausing, skipping or fixing the queue
meant walking over to it. Issue #22 first proposed pairing a phone by scanning a second
QR code; the owner asked for something simpler.

## Decision
- The first guest whose phone loads the session becomes its **remote**. `get_state`
  records that guest id in `sessions.remote_guest_id` the first time it sees a guest id
  that is not the main screen's own browser, and reports `isRemote` to that phone.
- The remote may do what the main screen does to playback and the queue: play, pause,
  skip, remove any song, reorder. `karaoke.can_control` is the one check, used by
  `playback`, `move_item` and `remove_item`.
- Ending the session stays with the main screen. The video still plays only there; the
  main screen follows play and pause set from the phone.
- There is one remote per session, and it does not change.
- Separately, whoever added the song being sung may skip it, and do nothing else: no
  pause, no queue changes. It is checked in `playback` beside `can_control`.

## Why
- No setup and nothing to explain: the person who opens the link first, usually the
  host with their own phone, already has the controls.
- One extra column and one helper; host rights (0004) are untouched, the remote is a
  second, narrower way to control the session.
- The QR pairing alternative needed a short-lived copy of the host's raw token in the
  database (it only stores a hash) and a second QR code on the screen.

## Consequences
- **Whoever gets there first wins.** If a guest scans the code before the host's phone,
  that guest is the remote. There is no way to hand it over or take it back yet.
- The remote is tied to the phone's guest-id cookie: clearing cookies or switching phone
  loses it, for good, for that session.
- A guest's phone is a phone (0007 still sends phones to the guest screen); the remote
  only adds controls to that screen.
- `playback` and `move_item` gained a signature with `p_guest_id`. The old signatures
  stayed, host only, so the previous app kept working during the rollout; migration
  0011 dropped them.

## Revisit when
- The wrong person ends up as the remote at real parties: add a way for the main screen
  to hand the remote to someone else, or to clear it.
- Hosts want more than one remote (co-hosts).
