# 0019. Main screen controls: four buttons, a Settings menu, and confirmations

- Status: Accepted
- Date: 2026-11-22

## Context
The main screen had six controls in one row under the video (play or pause, forward 10
seconds, next, a volume slider, full screen) and three more in the header (Take turns,
End session, Hide queue), all with about the same weight. Hosts mostly press Next and
Full screen. The queue panel had three tabs (Up next, Edit queue, Add a song). Hosts
also wanted to start any waiting song straight away, not only the next one, without
being able to do it by accident from across the room.

The owner reviewed a mockup in the YouOke design canvas and chose this layout.

## Decision
- **Four transport buttons, all the same size**, icons only (with names for screen
  readers and tooltips): play or pause, forward 10 seconds, next song, full screen.
  Next song is the screen's one `encore` button; play or pause is `ink`; the other two
  are `stage-200`.
- **A Settings menu** in the header holds everything else: volume, Take turns, hide or
  show the queue, and End session. It is a disclosure (a button and a panel), not an
  ARIA menu, because it holds a slider and a switch. Escape closes it; up and down move
  between its controls for TV remotes.
- **The queue panel has no tabs.** It is "Up next" with an edit button beside the
  heading. Editing shows Play now, Move and Remove on each song. "Add a song" is a
  button above the join card; it swaps the list for search, with a way back.
- **Play now** starts a picked waiting song at once and ends the one being sung, through
  the database function `play_item` (migration 0012). Like "next", it names the song it
  interrupts, so a repeated press cannot end a second song.
- **Play now and End session ask first**, in a modal dialog whose Cancel button has the
  focus, so a double press on a remote cancels instead of confirming. This replaces the
  two-press End session button.
- The phone remote keeps its own controls (ADR 0014); it gets no Play now for now.

## Why
- Fewer, larger buttons for the actions people actually use, readable from the sofa.
- A menu keeps the rare and risky actions (End session) away from the buttons pressed
  every song.
- A dialog says what will happen ("this song stops, Sam is up") in a way a second press
  on the same button could not.
- Play now as one database call keeps it atomic: moving the song to the top and then
  skipping would be two calls that another screen could get between.

## Consequences
- Volume and Take turns are one more press away.
- "Play next" (send to the top) is no longer on the main screen's rows; Move does the
  same in two presses. The phone remote still has it.
- Two dialogs share one component, `ConfirmDialog`.

## Revisit when
- Hosts ask for volume on the main row, or often miss Take turns.
- Play now is used mostly from the phone remote, which would then want it too.
