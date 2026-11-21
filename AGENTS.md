<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working in this repository

- Read `docs/ARCHITECTURE.md` (layout, layer rules, where new code goes) and
  `docs/CONVENTIONS.md` (vocabulary, naming, test-first workflow) before changing code.
- Before changing something a record in `docs/adr/` covers, read that record. If
  you reverse a decision, add a new record that supersedes it.
- Rules about permissions and queue behaviour belong in a new migration under
  `supabase/migrations` (never edit an applied one), with assertions in `supabase/tests`.
- Write the failing test first. `npm run check` must pass before pushing;
  `npm run test:db` too if you touched SQL.
