# 0005. YouTube IFrame player with our own controls

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commits `fa72792`, `551bc7b`)

## Context
The app plays karaoke and lyrics videos that live on YouTube, on a TV across the
room, driven by a remote or a keyboard.

## Decision
The host screen embeds YouTube's official IFrame player
(`components/host/Player.tsx`) with YouTube's controls, keyboard handling and
full-screen button turned off. A transparent button covers the video. The app
draws its own play/pause, forward, next, seek, volume and full-screen controls.
We store only video ids, titles, channel names and durations; video streams from
YouTube straight to the host's browser.

## Why
- The official embed is the supported way to play YouTube video: no downloading,
  no proxying, nothing of YouTube's stored on our side.
- YouTube's controls are sized for a mouse at arm's length and include links that
  leave the page. Our controls are sized for a TV, reachable by Tab and arrow
  keys, and cannot navigate away mid-party.
- Covering the video stops clicks reaching YouTube's own overlay links.

## Consequences
- Videos whose owners disable embedding cannot play. Search hides them (0006) and
  the player skips any that slip through, with a notice.
- Browsers may block autoplay with sound until the first click; the player
  detects this and asks for one.
- We depend on the IFrame API's behaviour (events, player variables), typed by
  hand for the parts we use.
- Only one screen plays video. Other screens showing `/s/CODE` see a still image.

## Revisit when
- YouTube changes embed terms or behaviour in a way that breaks playback or
  requires its own controls to be visible.
- We want sources other than YouTube, or playback on more than one screen.
