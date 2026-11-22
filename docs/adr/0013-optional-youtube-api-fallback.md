# 0013. Fall back to the official YouTube API when a key is set

- Status: Accepted
- Date: 2026-11-22
- Amends: 0002 (no secrets), 0006 (keyless search)

## Context
Search runs through `youtubei.js`, YouTube's unofficial internal API (0006). When YouTube
changes that API or throttles the server's address, every search fails, nobody can add
songs, and the only fix is waiting for a library release. For a karaoke app, search down
means the app is down.

## Decision
- Keyless search stays first, and stays the only search when no key is configured.
- If keyless search throws or times out **and** the server has `YOUTUBE_API_KEY`, the
  same query goes to the official YouTube Data API v3 (`lib/server/youtube-data-api.ts`):
  `search.list` for embeddable videos, then `videos.list` for lengths and live status.
- Both answer in the same `SearchResult` shape behind the same `searchVideos(query)`, and
  share its 10-minute cache.
- The key is server-only: never `NEXT_PUBLIC_`, never sent to browsers, kept out of error
  messages (the request URL carries it, so errors name only the endpoint and status).

## Why
- Fallback-only spends quota only when it is needed. The default quota is 10,000 units a
  day and one search costs 101, so about 99 searches a day: enough to get a party through
  an outage, not enough to be the main search.
- Optional keeps setup key-free, which was the point of 0006.
- `videoEmbeddable=true` and `status.embeddable` make the per-result oEmbed check
  unnecessary on this path.

## Consequences
- The app can now hold a secret, which 0002 said it did not. It is optional, server-only,
  and grants nothing in the database; losing it costs quota, nothing more. Rotate it in
  Google Cloud if it leaks.
- Two providers to keep working instead of one. The mapping of each is unit-tested.
- With a key set, an outage of keyless search goes unnoticed except in the logs
  ("Keyless YouTube search failed; using the Data API").

## Revisit when
- The fallback runs often: then keyless search is no longer reliable enough to be first,
  and the order (or a paid quota) should change.
- The quota runs out during real parties.
