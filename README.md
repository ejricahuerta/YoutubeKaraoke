# YouOke

Karaoke night with a shared queue. One screen plays YouTube karaoke and lyrics
videos; everyone else scans a QR code and adds songs from their phone.

- **Main screen** (`/s/CODE`): video on the left, queue on the right, with
  the app's own large controls (play/pause, forward 10 s, next, seek bar, volume,
  full screen) and a button to hide the queue. YouTube's own player controls are
  turned off. Controls are sized for a TV and work with a keyboard or remote
  (Tab/arrows to move, Enter to press, media keys for play/pause, next and
  fast-forward). Reloading keeps the session and resumes the current song.
- **Phones** (`/join/CODE`): scan the QR code, enter a name, search, tap + to
  add. Guests can remove their own songs; only the main screen can pause, skip,
  reorder or remove other people's songs.
- **Phones only add songs.** A phone that opens the start page or a main
  screen link is sent to the add-songs view; sessions are started from a
  computer, TV or tablet.
- **Multiple sessions** run independently, each with its own 6-character code.
- **Singers, not just songs.** Each name gets a colour and an initial on every
  screen. Before each song the main screen shows a 10-second "you're up" call-out
  (Play starts it at once), and in the last 30 seconds of a song a banner names
  the next singer. Phones show your place in line and a rough wait.
- **The QR code never leaves the main screen**: it is in the queue panel, and
  moves to a corner of the video when the panel is hidden or in full screen.

The look follows the YouOke design system: tokens live in
`app/globals.css`, and the main screen is drawn on a 1920 x 1080 grid that
scales with the window, so it reads the same on a laptop and a 4K TV.

## How it works

- **Next.js** (App Router) serves the pages and a small API.
- **Supabase Postgres** stores sessions and queues in a dedicated `karaoke`
  schema. Tables have row level security with no policies; all access goes
  through database functions that check the host token or guest id.
- **Supabase Realtime** broadcasts a "changed" ping per session; screens refetch
  when they receive it (and poll every 15 s as a fallback).
- **Playback** uses YouTube's official IFrame player on the main screen. Video
  streams directly from YouTube; the app stores only video ids and titles.
  Videos whose owners disable embedding are skipped automatically.
- **Search** uses `youtubei.js` on the server (no API key) and hides videos
  that cannot be embedded. It is unofficial and
  can break or be throttled; everything YouTube-specific is in
  `lib/server/youtube-search.ts`.

The browser that starts a session gets an httpOnly host cookie for it.

The host can end a session from the main screen. Otherwise a session is archived,
and closed for good, after 15 minutes of inactivity.
Activity means the main screen is open, or someone adds a song or uses a control,
so a long song never ends a session but closing the main screen does.
Archived sessions and their songs are deleted 24 hours later.

More detail, and the reasons behind each of these choices:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the parts, the code layout, the
  data model and where new code goes.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): vocabulary, naming and how to work
  on the code.
- [docs/adr/](docs/adr/README.md): one record per decision, each with what would
  make it the wrong choice.

## Setup

1. Create a Supabase project and apply the files in `supabase/migrations/`:
   `DATABASE_URL=<its Postgres connection string> npm run migrate`. Production
   builds on Vercel do this themselves; see `supabase/migrations/README.md`.
2. In the Supabase dashboard, open Project Settings > API (Data API) and add
   `karaoke` to **Exposed schemas**.
3. Copy `.env.example` to `.env.local` and fill in the project URL and
   publishable (anon) key. No secret key is needed.
4. Run it:

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000 on the big screen and start a session. Phones must
   be able to reach the same address, so for a real party deploy it (below) or
   use your computer's LAN address.

## Deploy

Deploy to Vercel (or any Node host) and set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the project's environment variables.

Optionally also set `YOUTUBE_API_KEY` (a YouTube Data API v3 key from Google Cloud).
Search then falls back to YouTube's official API when the keyless search breaks; without
it, a broken keyless search means no search. See `docs/adr/0013`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Lint, types and unit tests: run before pushing |
| `npm run lint` | ESLint, including the layer rules in `docs/ARCHITECTURE.md` |
| `npm run typecheck` | TypeScript |
| `npm test` / `npm run test:watch` | Unit tests (Vitest) |
| `npm run test:db` | Database function tests (needs a local Postgres, below) |
| `npm run test:e2e` | Browser tests for the screens (first time: `npx playwright install chromium`) |
| `npm run test:integration` | The built app against a real database and API, in Docker (below) |

### Database tests

The rules of the app live in Postgres functions, and `supabase/tests` checks them
against a real database. The runner drops and recreates the `karaoke` schema, so
it only accepts a local server:

```bash
docker run --rm -d --name youoke-test-db -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:5432:5432 postgres:16
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

### Integration tests

`npm run test:integration` runs the app the way production does, against a real
database: Postgres, PostgREST (what Supabase serves the database with) and an nginx
proxy start in Docker (`docker/compose.test.yml`), the migrations are applied with the
production runner, and `tests/integration` drives the built app over HTTP as a main
screen and several phones. It needs Docker running and ports 3230, 54321 and 54329
free, and cleans up after itself.

CI runs all of the above on every pull request.

## Credits

Made by [edmel.dev](https://edmel.dev).
