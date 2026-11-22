# Migrations

Applied in file-name order. Never edit one that has been applied anywhere; add a new file.

## Where they are applied

The production database is the Supabase project named **default**
(`bkagbhgycjdtkxpaecly`). It also holds other apps' schemas, so its migration history
(Supabase dashboard > Database > Migrations, or `supabase_migrations.schema_migrations`)
is shared. Every karaoke entry is named `karaoke_<file name without number>`:

| File | History version | History name | How it was applied |
| --- | --- | --- | --- |
| `0001_init.sql` | `20261121075005` | `karaoke_init` | Pasted into the SQL editor; recorded in the history afterwards |
| `0002_archive_sessions.sql` | `20261121084344` | `karaoke_archive_sessions` | Pasted into the SQL editor; recorded in the history afterwards |
| `0003_keep_queue_order_exact.sql` | `20261122015254` | `karaoke_keep_queue_order_exact` | Applied as a migration |
| `0004_end_session.sql` | `20261122015304` | `karaoke_end_session` | Applied as a migration |
| `0005_show_sung_tonight.sql` | `20261122020601` | `karaoke_show_sung_tonight` | Applied as a migration |
| `0006_limit_waiting_songs_per_guest.sql` | `20261122022209` | `karaoke_limit_waiting_songs_per_guest` | Applied as a migration, after the app that knows `guest_limit` was live |
| `0007_warn_when_main_screen_is_gone.sql` | `20261122023635` | `karaoke_warn_when_main_screen_is_gone` | Applied as a migration |
| `0008_song_limit_only_with_three_people.sql` | `20261122025117` | `karaoke_song_limit_only_with_three_people` | Applied as a migration |
| `0009_main_screen_is_not_limited.sql` | `20261122033001` | `karaoke_main_screen_is_not_limited` | Applied as a migration, after the app that sends `p_host_hash` was already live: adding songs failed in production until it was |
| `0010_first_guest_is_the_remote.sql` | `20261122060712` | `karaoke_first_guest_is_the_remote` | By the production build (ADR 0015), the first file applied that way |

The two entries recorded afterwards hold a note naming the file and commit instead of
the SQL itself.

## Applying a new one

Merge it. A production build on Vercel runs `scripts/migrate.mts` before `next build`
(ADR 0015): it applies every file whose `karaoke_<name>` entry is missing from the
history, each in a transaction with its entry, and fails the build if one fails, so the
previous deployment keeps serving. Preview, CI and local builds skip it.

1. Write it so it works with the app that is live now (add first; drop later).
2. Run `npm run test:db` locally; CI runs it too.
3. Merge. The table above records how the early files got there; new files need no row,
   since the build records each in the history.

It needs `DATABASE_URL` set for **Production** in the Vercel project: Supabase >
Project Settings > Database > Connection string, session pooler. Without it a
production build fails instead of shipping code ahead of its database.

By hand, against any database: `DATABASE_URL=... npm run migrate`.

Moving to the Supabase CLI's own file naming is issue #20. Because the project is
shared, `supabase db push` from this repository would see the other apps' entries as
unknown, which is why the runner matches entries by name.
