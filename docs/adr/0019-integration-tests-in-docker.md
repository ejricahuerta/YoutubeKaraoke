# 0019. Test the built app against a real database in Docker

- Status: Accepted
- Date: 2026-11-22
- Amends: 0012 (testing strategy)

## Context
Every layer had tests, but none joined them. The SQL tests call the database functions
directly; the route tests replace the database gateway with a fake; the browser tests
fake the whole API. So the app could call a function with an argument name the
database did not have, and every test passed. That is how #41 broke adding songs in
production: the app sent `p_host_hash` before the database had a function taking it.

## Decision
- `npm run test:integration` (`scripts/test-integration.sh`) starts, in Docker
  (`docker/compose.test.yml`): Postgres 16, PostgREST (which is what Supabase serves the
  database through) and an nginx that adds Supabase's `/rest/v1` prefix.
- `docker/init.sql` creates what a Supabase project has and the migrations expect: the
  `anon`, `authenticated` and `service_role` roles, the `authenticator` role PostgREST
  logs in as, and the migration history table.
- The migrations are applied with the production runner (`scripts/migrate.mts`, ADR 0015).
- A JWT secret is generated for each run and the anon key is signed with it, as on
  Supabase, so no secret is committed.
- The app is built and started (`next build`, `next start`) against that API, and
  `tests/integration` drives it over HTTP with a small cookie-keeping client, acting as a
  main screen and several phones through a whole night: start, join, add, remove,
  reorder, play and pause, skip, settings, end.
- CI runs it as its own job. It is kept out of `npm test`, which stays fast and needs
  nothing installed.

## Why
- It tests the one seam nothing else covered: route, session store, supabase-js,
  PostgREST, Postgres function. The unit tests check that the app sends the arguments
  they were written to expect; only this checks the database actually takes them.
  Calling `add_item` with a wrong argument name fails six of its steps.
- PostgREST is the real thing Supabase runs, so argument names, defaults, grants, schema
  exposure and JSON shapes behave as in production. Calling the functions with `pg` from
  the tests would have skipped exactly those.
- Docker is already how the database tests are documented, and GitHub's runners have it.
- The Supabase CLI's local stack (`supabase start`) would match production more closely
  but starts a dozen containers, takes minutes, and needs the CLI; three small
  containers do what these tests need.

## Consequences
- Running it locally needs Docker, and ports 3230, 54321 and 54329 free.
- Realtime is not part of it: the screens' live updates are covered by the browser tests
  with a fake API, and Postgres here has no `realtime` schema (the migrations treat it as
  optional).
- YouTube search is not part of it: it would call YouTube from CI.
- A run builds the app, so it takes about a minute.

## Revisit when
- The app starts using Supabase features beyond PostgREST (Auth, Storage, Realtime on
  the server): switch to `supabase start`.
- The run gets slow enough to skip: split the suite, or reuse one build across jobs.
