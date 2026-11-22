# 0016. Singers take turns, one song per round

- Status: Accepted
- Date: 2026-11-22

## Context
Songs played in the order they were added. One keen guest could queue several songs in a
minute and everyone after them waited. The per-guest cap (migrations 0006 and 0008:
3 waiting songs once 3 people are singing) limits the damage but is not fair: whoever
adds first still sings first, three times. Issue #21 proposed taking turns as an
option, off by default. The owner chose: on by default, only with 3 or more people,
and a switch on the main screen.

## Decision
- **The rule.** A singer's waiting or current songs are rounds 1, 2, 3, ... in queue
  order. A new song goes after the last waiting song of its own round, or first when
  there is none. Only waiting and current songs count: a song sung earlier tonight does
  not, so a newcomer's first song goes ahead of everyone's second.
- **Only with 3 or more singers** waiting or on stage, the same threshold as the song
  limit (`PEOPLE_BEFORE_SONG_LIMIT`). With 1 or 2, songs go to the end.
- **When turns start applying** (the third singer's song arrives, or the host switches
  turns back on), the whole waiting list is put in turns once. Otherwise someone who
  queued three songs while alone would keep that head start. After that each new song
  is placed in its turn, which keeps the list in turns.
- **Who the singer is.** A phone (`guest:<guest id>`), whatever name it types, so
  renaming does not buy a new first turn. Songs the main screen adds belong to the name
  typed (`name:<lower-case name>`), because it adds for everyone without a phone.
- **A setting**, `sessions.take_turns`, on for every new session. Only the main screen
  changes it (`set_take_turns`, the "Take turns" switch); switching it off leaves the
  order as it is and new songs go to the end.
- Songs keep an explicit `position`. The main screen and the remote can still move any
  song anywhere, and later songs fit around that. `place_item`, `waiting_rounds`,
  `turns_apply` and `arrange_turns` are internal helpers shared by `add_item`,
  `move_item` and `set_take_turns`.

## Why
- Fair by default, nothing to explain; the switch is there for nights that want plain
  first come, first served.
- With one or two people, turns change little and surprise people who queue a few
  songs for themselves.
- Placing at insert time keeps everything downstream unchanged: what plays next is
  still the lowest position, and the screens, wait estimates and reordering need no
  changes. Computing the order on every read would fight with manual reordering.
- A stored `singer` column, because a song added on the main screen cannot otherwise
  be told apart from one added on a phone.

## Consequences
- The order is no longer the order of adding. A guest's toast and "My songs" still show
  their real place and wait, since both read the queue.
- Putting the whole list in turns replaces any manual order. That happens when a third
  singer arrives, when the number of singers drops below 3 and comes back up, and when
  the host switches turns on again.
- Two people sharing one phone count as one singer; on the main screen, two people with
  the same name count as one.
- The remote cannot change the setting; only the main screen can, like ending the session.

## Revisit when
- Hosts reorder by hand and then lose that order when a third person arrives: only
  arrange when switched on, or keep manually moved songs where they are.
- People complain a song they added early sits behind newcomers for a long time: weigh
  songs sung earlier tonight too.
