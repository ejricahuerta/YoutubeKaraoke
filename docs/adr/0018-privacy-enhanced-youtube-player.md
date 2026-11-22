# 0018. YouTube's privacy-enhanced player, with our own controls

- Status: Accepted
- Date: 2026-11-22
- Supersedes: [0005](0005-youtube-iframe-player.md)

## Context
0005 embedded YouTube's IFrame player from `https://www.youtube.com`. That domain sets
Google's cookies on the host screen as soon as the player loads, with no consent asked.
The Cookie Policy (`app/(legal)/cookies`) has to list them as other companies' cookies,
and under EU and UK ePrivacy rules cookies that are not strictly necessary normally need
consent first. YouTube offers a "privacy-enhanced mode" served from
`https://www.youtube-nocookie.com`. The IFrame API takes it as the `host` option of
`YT.Player`, and the player's events and methods are the same.

## Decision
Everything in 0005 still holds except where the player comes from:

- The host screen embeds YouTube's official IFrame player (`components/host/Player.tsx`)
  with `host: YOUTUBE_PLAYER_HOST` (`https://www.youtube-nocookie.com`, defined in
  `lib/domain/video.ts`). The API script is still `https://www.youtube.com/iframe_api`.
- YouTube's controls, keyboard handling and full-screen button stay off. A transparent
  button covers the video. The app draws its own transport controls.
- The CSP's `frame-src` allows only the nocookie host, so a regular `youtube.com` embed
  shows up in the CSP reports. `script-src` keeps `https://www.youtube.com` for the API
  script.

## Why
- Privacy-enhanced mode sets no YouTube cookies before a video plays, and Google says
  views in it do not affect what the viewer is shown on YouTube. That is less than
  `youtube.com` sets, at no cost to the app: the API, events, error codes and player
  variables are the same.
- Lost alternatives: a click-to-load placeholder with a consent prompt (a TV across the
  room with no mouse should not need a banner before the music, and it would not change
  what happens once a song plays); proxying or downloading video (against YouTube's
  terms, and what 0005 avoided).

## Consequences
- **This does not make the host screen cookie-free.** Songs autoplay, so YouTube sets its
  cookies once the first song plays. The nocookie iframe also writes local storage and
  IndexedDB on its own origin when it loads, and the API script request goes to
  `youtube.com`. The Cookie Policy and Privacy Policy say so. Whether that needs consent
  under ePrivacy is not settled by this change.
- Embeddability is unchanged: videos whose owners disable embedding fail with errors
  101/150 in either mode. Search still hides them (0006) and the player skips any that
  slip through.
- Autoplay is unchanged: the browser's policy is the same for both hosts, so the player
  still detects a blocked start and asks for one click.
- It cannot be tested here: browser tests block YouTube, so they check only that the
  page asks for the nocookie host. Real playback is checked by hand on a preview deploy.
- Some ad blockers and privacy extensions treat `youtube-nocookie.com` differently from
  `youtube.com`, in either direction.

## Revisit when
- YouTube drops or changes privacy-enhanced mode, or it stops supporting the IFrame API
  events or player variables we use.
- Playback on a preview deploy behaves differently from `youtube.com` (no events, no
  autoplay, wrong errors).
- We decide YouTube's storage on the host screen needs consent: then the player needs a
  consent step before it loads, and this record is superseded.
