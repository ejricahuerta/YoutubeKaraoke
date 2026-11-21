# 0009. Host screen drawn on a scaling 1920 × 1080 grid

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `9bdfcb5`)

## Context
The host screen is read from a sofa on anything from a 13-inch laptop to a 4K TV.
Ordinary responsive design keeps text the same physical size and reflows the
layout, which makes it tiny on a TV.

## Decision
The host screen sets the root font size from the viewport
(`html{font-size:max(10px,min(0.8333vw,1.4815vh))}` in
`components/host/HostScreen.tsx`) and sizes everything in `rem`. The layout is
designed once on a 1920 × 1080 canvas where 1rem is 16px, and the whole screen
scales with the window like a slide.

Controls used up close in the queue panel (edit, add a song) reuse the phone-sized
components, enlarged with `zoom`.

## Why
- The room sees the same composition on every display: nothing reflows, so
  nothing can be cut off or dwarfed.
- One design to make and check, at one size.
- Reusing the guest components for the up-close tabs avoids a second search and
  queue editor.

## Consequences
- Sizes in host components are `rem` values that only make sense on that canvas
  (`text-[1.5rem]` is "24px at 1080p"). They are not interchangeable with sizes
  in guest components.
- The rule is injected by the host screen, so it applies only while that
  component is mounted.
- Very narrow windows hit the 10px floor and fall back to a stacked layout.
- `zoom` is a non-standard property that current browsers support.

## Revisit when
- The host screen needs to work in portrait or on phone-sized windows (see 0007).
- A browser we care about mishandles `zoom` or viewport-based root sizing.
