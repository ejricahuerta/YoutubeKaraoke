# 0011. `lib` split into domain, server and client, enforced by lint

- Status: Accepted
- Date: 2026-11-21

## Context
`lib/` was one flat folder of fourteen files. Some ran only on the server (cookies,
database), some only in the browser (hooks, localStorage), some anywhere. Nothing
said which was which, file names mixed styles (`useSessionState.ts` beside
`browser-hooks.ts`), and the two screen components had grown to 576 and 330 lines
with logic, layout and sub-components in one file. Decisions such as drag-and-drop
targets and remote-key handling were inline in components, where they could not
be tested.

## Decision
Three folders under `lib`, with imports allowed in one direction only:

- `lib/domain`: types and pure functions. No React, Next, Node or Supabase imports.
- `lib/server`: cookies, the database gateway, YouTube search, route-handler plumbing.
- `lib/client`: hooks, the browser's API calls, localStorage, Realtime.

`components` and `lib/client` may not import `lib/server`. ESLint's
`no-restricted-imports` enforces all of this (`eslint.config.mjs`). Components are
grouped as shared, `host/` and `guest/`. Logic that needs no browser moved out of
components into `lib/domain`. Naming rules are in `docs/CONVENTIONS.md`.

## Why
- The folder a file is in now says where it runs, which is the first question
  when reading or changing it.
- Importing server code into the browser fails lint with a message that says what
  to do, instead of failing at build time or leaking into a bundle.
- Pure code in `lib/domain` is testable with no mocks, which makes test-first work
  cheap (0012).
- Lint rules were chosen over the `server-only` package because they need no new
  dependency and also cover the domain layer's purity, which that package cannot.
- A heavier structure (feature folders, dependency injection, a repository
  interface) was rejected: the app has one database and two screens, and each of
  those would add indirection with nothing to vary behind it.

## Consequences
- Adding an API call touches four small files (route, parser, store, client).
  That is the cost of each layer doing one job.
- The lint rules only catch `@/` alias imports; a relative import that climbs out
  of a layer would slip past. The codebase uses the alias across layers.
- `lib/domain` cannot use `node:crypto`, so session code generation lives in
  `lib/server/session-store.ts`, apart from its validation.

## Revisit when
- The app grows a second, separate area (accounts, say) and folders by feature
  would group related code better than folders by where it runs.
- Next.js offers a built-in boundary check that makes the lint rules redundant.
