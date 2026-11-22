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

The two entries recorded afterwards hold a note naming the file and commit instead of
the SQL itself.

## Applying a new one

1. Run `npm run test:db` locally first.
2. Apply it as a migration, not by pasting into the SQL editor, so it lands in the
   history: from the dashboard, the Supabase CLI, or the Supabase MCP `apply_migration`
   tool, with the name `karaoke_<file name without number>`.
3. Add its row to the table above in the same pull request.

Moving to the Supabase CLI's own file naming is issue #20. Because the project is
shared, `supabase db push` from this repository would see the other apps' entries as
unknown; that needs settling before switching.
