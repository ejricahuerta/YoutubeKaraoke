# 0012. Test-first; pure logic unit-tested, database tested in Postgres

- Status: Accepted
- Date: 2026-11-21

## Context
The app had 14 unit tests in one file covering helpers. The rules that matter
most (permissions, queue order, archiving) live in database functions (0002) and
had no tests. Route handlers had none either.

## Decision
- Work test-first: a failing test, then the code.
- **Unit tests (Vitest, `npm test`)** for `lib/domain`, `lib/server` and the
  browser's API client, in `tests/` mirroring `lib/`. Route handlers are tested in
  `tests/api` with the database gateway and cookies replaced by fakes.
- **Database tests (`npm run test:db`)** are plain SQL files of `assert`
  statements in `supabase/tests`, run with `psql` against a disposable local
  Postgres after applying the real migrations. Each file runs in a transaction and
  rolls back. The runner refuses any non-local database because it drops the schema.
- CI (`.github/workflows/ci.yml`) runs lint, types, unit tests, a production build
  and the database tests on every pull request.
- Components and whole flows were not automated at first; see the update below.

## Why
- Each rule is tested where it lives. Faking the database in a unit test would
  prove only that the fake agrees with the test; the SQL tests run the real functions.
- Plain SQL with `assert` needs nothing installed beyond `psql`. pgTAP would give
  nicer output at the cost of an extension the test database must have.
- `setup.sql` creates the three Supabase API roles so the unmodified migrations
  apply to stock Postgres. The migrations already treat Realtime and `pg_cron` as optional.
- Component tests were left out for now: they need a DOM test setup and a mocked
  YouTube player, and most of the logic worth testing was moved out of components
  into `lib/domain` instead.

## Consequences
- The database tests need a local Postgres (Docker or installed); CI provides one.
- Realtime broadcasts are not exercised: `realtime.send` does not exist in the
  test database and `notify` swallows the error by design.
- A change that breaks how a component wires things together can pass every test.
  During the 2026-11 restructure this gap was covered by hand, by comparing
  screenshots of every screen before and after.

## Update, 2026-11-21: browser tests added

The "Revisit when" condition below was met within a day: checking screens by hand
was done twice for two changes. `e2e/` now holds Playwright tests that run the
production build with the session API answered by fixtures (`e2e/session.ts`) and
YouTube blocked, so they need no Supabase project. They cover the flows of both
screens and the start page, and run in CI as a third job (`npm run test:e2e`).

- The session API is faked at the network layer, not inside the app, so the tests
  exercise the real components, hooks and API client.
- The test server's database address is a closed local port. The one test that
  needs the server to really fail ("a session cannot be started") relies on that.
- `@playwright/test` is pinned to an exact version, because the browser build it
  downloads is tied to it.
- Still not covered: the app against a real Supabase project, Realtime, and real
  YouTube playback.

## Revisit when
- A regression ships that a browser-level test would have caught. Add Playwright
  flows against a mocked session API first (cheap), a real Supabase second.
- The SQL tests outgrow bare `assert` (need for fixtures, clearer failure output):
  move to pgTAP or the Supabase CLI's test runner.
