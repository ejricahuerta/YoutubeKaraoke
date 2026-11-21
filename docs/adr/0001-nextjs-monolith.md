# 0001. One Next.js app serves pages and API

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `fa72792`)

## Context
The app needs three server-side things: render pages, read httpOnly cookies to
know who is asking, and call YouTube search and the database without exposing
either to browsers. It is a small hobby app with one maintainer.

## Decision
A single Next.js App Router project. Pages are server components that only
validate the URL and pick a screen; the screens are client components; the API is
route handlers under `app/api`. It deploys to Vercel as one unit.

## Why
- One repository, one deploy, one set of types shared by API and UI.
- Route handlers give the cookie and server-only access we need with no separate
  backend to run.
- The alternatives were a separate API service (more to deploy and keep in step)
  or talking to Supabase straight from the browser (rejected in 0002 and 0004:
  host rights rest on an httpOnly cookie the browser cannot read).

## Consequences
- Route handlers run as serverless functions: no shared memory between instances
  and no long-lived connections. This shapes 0003 and 0010.
- We follow Next.js major versions; `AGENTS.md` warns that APIs change between them.

## Revisit when
- Something needs a long-lived server process (for example server-driven playback
  sync or WebSockets of our own).
- A second client appears (native app, TV app) that needs the API without the pages.
