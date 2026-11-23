# Conventions

Short rules so the codebase reads like one person wrote it. When a rule and
readable code disagree, pick readable code and fix the rule here.

## Words

One word per thing, everywhere: code, database, comments and what people read.

| Word | Means | Not |
| --- | --- | --- |
| **session** | One karaoke night, identified by its code | room, party, game |
| **session code** / `code` | The 6 characters guests type | id, pin |
| **host** | The browser that started the session and plays the video | admin, owner |
| **host screen** (UI text: "main screen") | The page at `/s/CODE` | TV page, player page |
| **guest** | Any other browser in the session | user, client |
| **singer** | The name a song was added under | user, author |
| **queue item** (code) / **song** (UI text) | One added video waiting, playing or played | track, entry |
| **current** | The queue item playing now | active, now-playing |
| **queue** | Items still waiting, in order; never includes current | list, playlist |
| **archived** | Session closed for good after inactivity | expired, deleted |

## Names

| Thing | Style | Example |
| --- | --- | --- |
| Component file and export | PascalCase, same name | `SearchPanel.tsx` exports `SearchPanel` |
| Any other file | kebab-case | `session-store.ts`, `use-session-state.ts` |
| Hook | `use` + noun, in a `use-*.ts` or `*-hooks.ts` file | `useSessionState` |
| Function | verb first | `normalizeSessionCode`, `addQueueItem` |
| Boolean function or value | `is`, `has`, `can`, `show` | `isVideoId`, `showQueue` |
| Parser of untrusted input | `parse…Request`, returns the value or `null` | `parsePlaybackRequest` |
| Type | PascalCase noun | `SessionState`, `MutationResult` |
| Constant | SCREAMING_SNAKE, unit in the name | `INTRO_SECONDS`, `POLL_MS` |
| Test file | Path of the module + `.test.ts` under `tests/` | `tests/domain/queue.test.ts` |
| Database table, column, function | snake_case | `queue_items`, `add_item` |
| Database function parameter / variable | `p_` / `v_` prefix | `p_code`, `v_session` |
| API JSON field | camelCase | `durationSeconds` |
| API and database result code | snake_case string | `queue_full` |
| localStorage key | `karaoke:` + kebab-case, listed in `STORAGE_KEYS` | `karaoke:queue-hidden` |
| Cookie | Short fixed names in `lib/server/auth.ts` | `kh_<CODE>`, `kg` |

The server names what it does to data (`addQueueItem`); the browser names what the
person does (`addSong`). Same operation, two vocabularies, on purpose: see the
"queue item / song" row above.

The cookie and localStorage names still say `karaoke` and `k…` from before the app
was renamed YouOke. Renaming them would log every host out of their session and
forget every guest's name, so they stay.

## Code

- **No magic numbers.** A number with a meaning gets a named constant next to the
  code that uses it, with the unit in the name.
- **One home per fact.** A limit, a pattern or a URL shape is defined once and
  imported. If the database also enforces it, the comment says which side is the
  authority (see the limits table in ARCHITECTURE.md).
- **Comments say why**, or what is not obvious from the code. They do not restate it.
- **Untrusted input is parsed once**, at the edge, into a typed value
  (`lib/server/request-parsers.ts`). Past that point code does not re-check types.
- **Browser API calls never throw.** `lib/client/session-api.ts` returns a result
  code; components choose the wording.
- **Route handlers stay thin**: cookies, parse, rate-limit, one database call,
  map the answer. A rule that needs an `if` about permissions or order belongs in
  a database function.
- **Small before clever.** Three similar lines are fine. Extract when there is a
  third copy or when the extracted piece is worth testing alone.

## Tests

Work test-first:

1. Write the failing test that describes the behaviour, in the words a person
   would use ("a guest cannot remove someone else's song").
2. Make it pass with the least code.
3. Tidy up with the tests green.

- Pure logic goes in `lib/domain` so it can be tested with no mocks. If something
  is hard to test, that usually means logic is sitting in a component or a route
  handler and wants to move down a layer.
- A bug fix starts with a test that fails because of the bug.
- A change to a database function comes with a new migration (never edit an
  applied one) and assertions in `supabase/tests`.
- A change to what a screen shows or does comes with a browser test in `e2e/`.
  Find things the way a person would, by role and visible text, never by class
  name or test id, and assert on what the page sent (`api.sent`) rather than on
  internals. Freeze time with `page.clock` instead of waiting.
- A new route, or a new call from `lib/server/session-store.ts` to the database,
  comes with a step in `tests/integration`, which runs the built app against a real
  database (`npm run test:integration`, needs Docker).
- `npm run check` (lint, types, unit tests) must pass before pushing. CI also runs
  the build, the browser tests, the database tests and the integration tests.

## Database migrations

- Files are `NNNN_what_it_does.sql`, applied in order, never edited after they
  have been applied anywhere.
- Production builds apply pending ones before the app goes live (ADR 0015), so
  merging is the only step. Each must therefore work with the app that is live now:
  add first, drop in a later migration.
- Every function is `security definer set search_path = ''` and fully qualifies
  names; internal helpers are revoked from the API roles. `supabase/tests/lifecycle.test.sql`
  fails if a new function forgets either.

## Decisions

A choice that someone could reasonably have made differently gets a record in
`docs/adr/`: what was decided, why, what it costs, and what would make it wrong.
Changing such a choice means adding a new record that supersedes the old one, not
rewriting history.
