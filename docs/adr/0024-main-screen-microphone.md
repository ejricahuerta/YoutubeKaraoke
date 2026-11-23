# 0024. The main screen's microphone

- Status: Accepted
- Date: 2026-11-22

## Context
Singers had no microphone: the only sound was the YouTube track. Hosts asked to sing through
the speakers of the device that plays the video, with echo and reverb like a karaoke machine,
and to check the mic works before the first song.

Two facts shaped the choice:
- The player is a cross-origin `youtube-nocookie.com` frame ([0018](0018-privacy-enhanced-youtube-player.md)),
  so its sound cannot be routed through Web Audio or mixed with anything in the page.
- Every page was sent with `Permissions-Policy: microphone=()`, which blocks the mic outright.

## Decision
- **Only the main screen has a microphone**: a built-in, USB or wired mic on the device that
  plays the video. Only the host's screen uses it; another computer's Settings has no
  Microphone row.
- **The voice gets its own `AudioContext`** (`lib/client/microphone-graph.ts`): mic → rumble
  cut → mic volume → speakers, with an echo (delay with capped feedback) and a reverb
  (convolver with a generated impulse, no file to download) mixed in. The video and the voice
  only meet at the speakers, so the Volume slider stays the video's alone.
- **Settings are kept per browser** in `karaoke:microphone` (`lib/domain/microphone.ts`), like
  Volume: on or off, the device, mic volume, echo level, delay and repeats, reverb level and
  room size, and three clean-up switches the browser applies when the mic opens (echo
  cancellation, noise suppression, auto volume). No database, no API.
- **Echo cancellation and noise suppression are on by default**, against feedback from the
  speakers. The panel says what a squeal means and what to do about it.
- **The controls have their own panel**, a modal dialog opened from a Microphone row in the
  Settings menu ([0023](0023-main-screen-controls.md)). Up and down move between its controls,
  as in the menu.
- **Test mic** makes the voice live with the current sound, and shows a level meter, for up to
  30 seconds or until the panel closes, without turning the mic on.
- **Delay**: the panel shows the delay the browser reports (capture, audio buffer and output)
  as "at least N ms": it leaves out the device's own audio engine and the mic's capture, and
  came to about half the real delay when measured (45 ms reported, 85 ms measured on a Windows
  laptop, with the phone-mic prototype on branch `claude/phone-mic-prototype`). **Measure delay** gives the real figure: it plays six short beeps through the
  speakers, records them side by side with the mic, and reports the median gap and spread
  (`clickDelaysMs`, `summarizeDelays`). The voice is muted while it runs, and echo
  cancellation has to be off (Low latency), or it removes the beeps. The panel also
  warns when the mic's name says it is on Bluetooth, which adds about 100–300 ms the
  browser cannot see. **Low latency** turns the three clean-up switches off and asks for the
  smallest buffers; it keeps the host's own clean-up choices for when it is turned off again.
  No setting can take Bluetooth's delay away, so the panel points to wired, USB or 2.4 GHz
  wireless mics and wired speakers instead.
- **After a reload with the mic on**, the browser keeps the new audio silent until someone
  presses something. The main screen says so, and the next press anywhere turns it back on.
- `Permissions-Policy` becomes `microphone=(self)`: the app's pages may ask, the YouTube frame
  may not.
- The sound never leaves the device: nothing is recorded or sent. The privacy policy says so.

## Why
- The main screen is the only browser with the video and the speakers; any other mic would
  have to stream to it.
- **A phone as the mic lost**: it needs WebRTC between each phone and the main screen, adds
  latency singers would hear, and goes against phones being guests
  ([0007](0007-phones-are-guests.md), [0014](0014-first-guest-is-the-remote.md)).
- Per-browser settings follow the device and its mic, not the session, like Volume.
- A panel rather than more rows: the mic has a dozen controls, and the Settings menu should
  stay short.

## Consequences
- Feedback is possible with open speakers and a nearby mic; echo cancellation reduces it but
  does not remove it, and adds a little latency.
- The voice runs a few tens of milliseconds behind the singer, depending on the device.
- The browser asks for the mic the first time; a refusal is shown with how to allow it.
- Web Audio code cannot be unit-tested here (tests run in Node), so its sums live in
  `lib/domain/microphone.ts`; the browser tests use Chromium's fake microphone.

## Revisit when
- Hosts ask to sing into their phones.
- Feedback or latency complaints show the graph needs a limiter or a lower-latency path.
- Two singers want a mic each on the same screen.
