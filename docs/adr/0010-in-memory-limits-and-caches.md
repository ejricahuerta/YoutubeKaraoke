# 0010. Rate limits and caches live in server memory

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `fa72792`)

## Context
Three things are worth limiting: YouTube searches (each one costs outbound
requests and risks throttling), session creation, and adding songs. Search results
and embeddability answers are worth caching for the same reason.

## Decision
A sliding one-minute window per key in a `Map` in the server process
(`lib/server/rate-limit.ts`): 40 searches and 10 session starts per IP address, 30
adds per guest id. Search results and embeddability are cached in `Map`s in
`lib/server/youtube-search.ts`. Each map is cleared outright when it grows past a
fixed size.

## Why
- No extra service to set up or pay for; the app needs only Supabase.
- The limits exist to stop accidents and casual abuse, not a determined attacker.
  The hard limits that matter (200 queued songs, who may do what) are enforced in
  the database (0002).

## Consequences
- **Best effort only.** On serverless hosting each instance has its own memory, so
  the real limit is the configured one times the number of warm instances, and it
  resets on every cold start.
- The caller's address comes from the first `x-forwarded-for` entry, which is
  trustworthy behind Vercel's proxy and spoofable elsewhere.
- Everyone behind one address (a venue's Wi-Fi) shares the search and start budgets.

## Revisit when
- Search gets throttled by YouTube because the limit is not holding across instances.
- Someone abuses session creation or search in practice.
- The app moves to a host where `x-forwarded-for` cannot be trusted.

The usual next step is a shared store (a Postgres table or a hosted key-value
store) behind the same `checkRateLimit` signature.
