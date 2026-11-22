# 0015. Production builds apply pending migrations first

- Status: Accepted
- Date: 2026-11-22

## Context
Migrations were applied by hand: from the SQL editor, or through the Supabase MCP tool,
whose confirmation prompt often went unanswered. Twice the app reached production before
the database it needed: PR #41 shipped before migration 0009, and adding songs failed
until someone applied it. Merging should be the only step.

## Decision
- `npm run build` runs `node scripts/migrate.mts --on-deploy` before `next build`.
- It migrates only when `VERCEL_ENV=production`. Preview, CI and local builds skip it,
  so nothing but a production deploy touches the production database.
- A production build without `DATABASE_URL` fails. Shipping app code ahead of its
  migrations is the failure this exists to prevent.
- A migration counts as applied when `supabase_migrations.schema_migrations` has an
  entry named `karaoke_<file name without number>`, whatever its version. Each pending
  file runs in a transaction with its history entry; a failure rolls both back and fails
  the build, so the site keeps serving the previous deployment.
- An advisory lock stops two builds migrating at once.
- `scripts/test-db.sh` applies the migrations with the same runner, twice, so CI tests it.

## Why
- **Order.** The build finishes before the new deployment takes traffic, so the database
  is always ahead of the code. A GitHub Action on merge would race Vercel's deploy.
- **Not `supabase db push`.** The project's history is shared with other apps (leads,
  bakery, cottage). `db push` treats their entries as unknown and stops; it also expects
  timestamp file names, and our history already uses `karaoke_<name>` with versions that
  do not match any file. Matching by name handles both. Issue #20 tracks a proper split.
- **Small.** About a hundred lines with `pg`, unit-tested planning and an end-to-end run
  in CI, against a dependency on the Supabase CLI and its login in the build.

## Consequences
- The Vercel project needs `DATABASE_URL` (Production only): the Postgres connection
  string from Supabase, Project Settings > Database > Connection string, session pooler.
  It is a real database password, so it lives only in Vercel's settings.
- **Every migration must work with the app that is live now**, because that app keeps
  serving while the build runs, and keeps serving if the build fails later. Add, then
  switch the app, then drop in a later migration. 0009 and 0010 already follow this.
- A migration runs as one transaction, so it cannot use statements that refuse one
  (`create index concurrently`, `vacuum`).
- Redeploying an old commit does not undo migrations. Rolling back means a new
  migration that reverses the change.
- Files must be named `NNNN_lower_case_name.sql`; the runner refuses anything else.

## Revisit when
- The karaoke database moves to its own project (issue #20): then `supabase db push`
  or the Supabase GitHub integration can replace this.
- A migration needs to run outside a transaction, or takes long enough to slow deploys.
