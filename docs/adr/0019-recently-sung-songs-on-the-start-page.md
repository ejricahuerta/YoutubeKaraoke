# 0019. Songs sung lately are shown on the start page

- Status: Accepted
- Date: 2026-11-22

## Context
The owner wanted the start page to feel alive: the songs people have been singing,
going up behind the "Joining a party?" and "Resume" cards like fireworks, each one a
music note and the song's name.

Until now a song was only ever shown to the people in its session (ADR 0002 keeps the
tables closed; the privacy policy said so). The start page is public, so this is the
first time anything from a session is shown to people outside it.

## Decision
- A new public database function, `recently_played()`, answers the YouTube video ids of
  songs finished in the last day, in any session, newest first, each video once, at most
  24. Nothing else: not the singer, not the session, not when.
- `GET /api/recent-songs` turns those ids into titles by asking YouTube's oEmbed endpoint
  (the same call, and the same in-memory cache, as the embeddable check). A video YouTube
  will not play here is left out. The answer is the same for everyone, so the CDN caches
  it for a minute.
- The start page fetches it from the browser (`components/RecentSongs.tsx`) and launches
  one song every 1.4 seconds from behind the cards. Screen readers get the same songs as
  a plain list named "Sung lately". People who ask for reduced motion see a few of them,
  still and faded.

## Why
- **Titles from YouTube, not from the database.** The title stored with a song is what
  the adding browser sent, so anyone could write anything onto the public start page by
  adding a song and skipping it. A video id can only name a real YouTube video, and its
  title is YouTube's.
- **No names or codes.** Singer names are personal and the session code is the key to a
  session; neither is needed for the effect.
- **A day.** Finished songs are deleted with their session a day after it closes anyway,
  so this keeps nothing longer than before.
- **Fetched by the browser** so the start page does not wait on YouTube, and so the
  browser tests can answer it from a fixture.
- Showing only this browser's own sessions' songs was the alternative; most visitors
  have none, so the page would almost always be empty.

## Consequences
- What was sung is public for a day, without who sang it. The privacy policy says so.
- A troll can still get a real YouTube video's title onto the start page by playing it.
- With no YouTube answer (offline, throttled) the list is empty, and the page looks as before.

## Revisit when
- Someone uses it to put unwanted titles on the start page: add a filter (for example,
  only sessions with several singers) or a block list.
- The app gets busy enough that one day's songs repeat the same few hits; widen or
  narrow the window.
