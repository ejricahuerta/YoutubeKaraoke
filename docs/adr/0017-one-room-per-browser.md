# 0017. One room per browser

- Status: Accepted
- Date: 2026-11-22

## Context
A guest could open the app in several tabs of the same browser and be in different rooms
at once. A new tab opened on the start page did not take them back to the room they were
in. The owner asked that every tab of a browser be in the same room under the same name.

## Decision
- The browser remembers the room it is in as a guest: `karaoke:room` in localStorage,
  next to the name (`karaoke:name`). Every tab reads the same values and re-renders when
  another tab changes them.
- The guest screen (`/join/CODE`) claims the room when the browser has none, or when its
  room has ended. If the browser is in another room that is still going, it shows
  "You're in room X" with **Back to room X** and **Switch to room CODE**, and loads
  nothing of CODE until the guest switches, because loading a room counts as joining it
  (it can make the browser the remote, ADR 0014). Switching moves every tab: tabs still
  on the old room then show the same message.
- The start page sends a browser whose room is still going straight back to it. A room
  that has ended or does not exist is forgotten.
- The name form (from the name chip) has **Leave room CODE**, which forgets the room and
  goes to the start page.
- The name was already one per browser; nothing changes there.

## Why
- localStorage is per browser and shared by its tabs, with change events across tabs,
  which is exactly the scope asked for. It needs no server change and no migration.
- Enforcing it on the server (binding the guest-id cookie to one session) would be
  stronger, but the goal is to stop confusion, not to stop a determined person: another
  browser or a private window is a new guest anyway (ADR 0004).
- Asking before switching, rather than refusing, covers the real case of walking from one
  party to another while the first is still going.

## Consequences
- A private window, another browser or another device is still a separate guest, with its
  own room and name.
- The main screen is unaffected: it is not a guest and remembers its sessions by host
  cookie.
- With storage blocked (some private modes), nothing is remembered and every tab behaves
  as before.

## Revisit when
- People use several rooms from one browser on purpose (a host running two parties): add a
  way to keep more than one.
- Abuse needs a guarantee: bind the guest cookie to one session on the server.
