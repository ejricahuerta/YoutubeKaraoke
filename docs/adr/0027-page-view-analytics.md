# 0027. Page views counted by Vercel Web Analytics, without session codes

- Status: Accepted
- Date: 2026-11-23

## Context
We had no way to tell how many people open YouOke, which pages they reach, or where they
come from. The app is hosted on Vercel, which offers Web Analytics through the
`@vercel/analytics` package. Its script reports the full page URL. The main screen's page is
`/s/[code]` and a phone's is `/join/[code]`, and the start page's "enter a code" form goes
through `/join?code=`. A session code is all anyone needs to join a session and add songs,
so sending raw URLs would hand every live code to a third party's dashboard.

## Decision
- The root layout renders `components/PageAnalytics.tsx`, a client component wrapping
  `@vercel/analytics/next`'s `<Analytics>` with a `beforeSend` hook.
- `beforeSend` passes every URL through `anonymizeAnalyticsUrl` (`lib/domain/analytics.ts`):
  the segment after `/s/` or `/join/` becomes `[code]`, the query string and hash are dropped,
  and anything that does not parse as a URL is not sent.
- Only page views are tracked; no custom events.
- In production the script and its endpoints are on the app's own origin
  (`/_vercel/insights`), so the CSP needs nothing new. In development the debug script comes
  from `https://va.vercel-scripts.com`, which `script-src` allows only when `dev` is set.
- The Privacy Policy and Cookie Policy say page views are counted, by whom, and that no
  cookies or session codes are involved.

## Why
- It is already part of the hosting we use: no new processor sees visitors' requests, no
  cookies, nothing in browser storage, so no consent banner (0018 keeps the main screen free
  of one).
- Redacting in `beforeSend` keeps the code out of the request itself, not just out of the
  dashboard. `lib/domain` keeps the rule pure and unit-tested.
- Lost alternatives: a self-hosted counter (a new table, a route and retention rules for a
  number we only glance at); Google Analytics or similar (cookies, consent, and a new
  company seeing every visitor); counting from request logs (no referrer breakdown, and the
  logs hold full URLs we would then have to scrub).

## Consequences
- Vercel tells visits apart with a hash of the request that it discards within a day; this
  is described in the Privacy Policy but not under our control.
- Data shows up only once Web Analytics is enabled for the project in Vercel's dashboard.
  Outside Vercel (local production builds, browser and integration tests) the script request
  to `/_vercel/insights/script.js` fails quietly.
- Any new page that puts a session code, or another secret, in its URL must be added to
  `anonymizeAnalyticsUrl` and its tests.

## Revisit when
- We leave Vercel, or Vercel Web Analytics starts setting cookies or browser storage.
- We need events beyond page views (songs added, sessions started): those would carry more
  about what people do and need their own decision.
- A legal review decides the request hash needs consent.
