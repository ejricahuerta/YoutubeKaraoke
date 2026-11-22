# 0006. Keyless search through youtubei.js, behind one module

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commits `fa72792`, `59877b6`)

## Context
Guests need to search YouTube from the app. The official Data API needs a key,
has a daily quota that a busy party can exhaust, and makes setup harder for
anyone running their own copy.

## Decision
Search runs on the server through `youtubei.js`, which speaks the same internal
API the YouTube website uses, with no key. Everything about it lives in
`lib/server/youtube-search.ts`, which exports `searchVideos(query)` returning our
own `SearchResult` shape. The module also:
- drops live streams and anything without a length,
- asks YouTube's oEmbed endpoint whether each result can be embedded and hides
  those that cannot,
- caches results for 10 minutes and embeddability indefinitely, in memory.

The search route only answers callers who give the code of a live session.

## Why
- No key means setup is "create a Supabase project" and nothing else.
- Hiding non-embeddable videos up front beats letting someone queue a song that
  will be skipped when their turn comes.
- Requiring a live session code keeps the endpoint from being an open YouTube
  search proxy.
- Keeping it to one file with one exported function means another provider can
  replace it without touching anything else.

## Consequences
- **This is unofficial.** It can break without notice when YouTube changes its
  internal API, and it can be throttled or blocked by IP. When it fails, the route
  answers `search_unavailable` and the screen says so.
- Each search makes up to 20 extra oEmbed requests (cached per video afterwards).
- The library is large; it is kept out of the bundle with `serverExternalPackages`.

## Update, 2026-11-22
The fallback named below now exists: see 0013. With `YOUTUBE_API_KEY` set, a failed
keyless search is retried through the official Data API.

## Revisit when
- Search breaks or is throttled often enough to spoil sessions. The fallback is
  the official Data API behind the same `searchVideos` signature.
- The library's upkeep stalls after a YouTube change.
