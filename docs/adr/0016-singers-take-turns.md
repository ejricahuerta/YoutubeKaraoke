# 0016. Singers take turns, one song per round

- Status: Accepted
- Date: 2026-11-22

## Context
Songs played in the order they were added. One keen guest could queue several songs in a
minute and everyone after them waited. The per-guest cap (migrations 0006 and 0008:
3 waiting songs once 3 people are singing) limits the damage but is not fair: whoever
adds first still sings first, three times. Issue #21 proposed taking turns as an
option, off by default; the owner chose to make it the only behaviour.

## Decision
- `add_item` places each new song after the last waiting song of its singer's round,
  instead of at the end. A singer's waiting or current songs are rounds 1, 2, 3, ... in
  queue order; a new one is the next round. With nothing in its round or earlier, it
  goes first.
- Only waiting and current songs count. A song sung earlier tonight does not, so a
  newcomer's first song goes ahead of everyone's second.
- The singer is the phone (`guest:<guest id>`), whatever name it types, so renaming does
  not buy a new first turn. Songs the main screen adds belong to the name typed
  (`name:<lower-case name>`), because it adds for everyone without a phone.
- It is placed once, when added. Songs keep an explicit `position`; the main screen and
  the remote can still move any song anywhere, and later songs fit around that.
- The placing logic is one internal function, `place_item`, shared by `add_item` and
  `move_item`.

## Why
- Fair by default, nothing to switch on or explain. A setting nobody finds helps nobody.
- Placing at insert time keeps everything downstream unchanged: what plays next is
  still the lowest position, and the screens, wait estimates and reordering need no
  changes. Computing the order on every read would fight with manual reordering.
- A stored `singer` column, rather than deriving it, because a song added on the main
  screen cannot otherwise be told apart from one added on a phone later.

## Consequences
- The order is no longer the order of adding. A guest's toast and "My songs" still show
  their real place and wait, since both read the queue.
- Turns are decided when a song is added, from the queue at that moment. Removing or
  moving songs later does not reshuffle the rest.
- Two people sharing one phone count as one singer; on the main screen, two people with
  the same name count as one.
- The cap of 3 waiting songs still applies; it now mostly stops one guest from holding
  many future rounds.

## Revisit when
- Hosts want plain first come, first served for some nights: add a per-session setting.
- People complain a song they added early sits behind newcomers for a long time: weigh
  songs sung earlier tonight too.
