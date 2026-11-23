/**
 * Applies supabase/migrations to a database, recording each in Supabase's migration
 * history (supabase_migrations.schema_migrations) as karaoke_<file name without number>.
 *
 * The production project's history is shared with other apps, so a file counts as
 * applied when an entry with its name exists, whatever its version. Each file runs in its
 * own transaction together with its history entry: a failure leaves neither behind.
 * See docs/adr/0015-migrate-on-production-build.md.
 *
 * Run by scripts/migrate.mts. Imports nothing from the app (Node runs it directly).
 */
import type { Client } from "pg";

const FILE_PATTERN = /^\d{4}_([a-z0-9_]+)\.sql$/;
/** Mirrors SESSION_SECRET_MIN_LENGTH in lib/server/auth.ts, which enforces it; this file imports nothing from the app. */
const SESSION_SECRET_MIN_LENGTH = 32;
/** Any constant key works; it only has to be the same for every build. */
const LOCK_KEY = 4815162342;

export function historyName(file: string): string {
  const match = FILE_PATTERN.exec(file);
  if (!match) throw new Error(`Migration files are named NNNN_name.sql in lower case: got ${file}`);
  return `karaoke_${match[1]}`;
}

/** The .sql files whose history name is not in `appliedNames`, in file-name order. */
export function pendingMigrations(files: string[], appliedNames: string[]): string[] {
  const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();
  const seen = new Map<string, string>();
  for (const file of sqlFiles) {
    const name = historyName(file);
    const other = seen.get(name);
    if (other) throw new Error(`${other} and ${file} would both be recorded as ${name}`);
    seen.set(name, file);
  }
  const applied = new Set(appliedNames);
  return sqlFiles.filter((file) => !applied.has(historyName(file)));
}

/** YYYYMMDDHHMMSS in UTC, like Supabase's own versions; `index` seconds later keeps a run's versions unique. */
export function historyVersion(at: Date, index: number): string {
  return new Date(at.getTime() + index * 1000).toISOString().replace(/\D/g, "").slice(0, 14);
}

export type DeployPlan = { run: true; databaseUrl: string } | { run: false; reason: string };

/** Whether this build should migrate: only Vercel production builds, and those must be able to. */
export function deployPlan(env: Record<string, string | undefined>): DeployPlan {
  if (env.VERCEL_ENV !== "production") {
    return { run: false, reason: env.VERCEL_ENV ? `${env.VERCEL_ENV} build` : "not a Vercel production build" };
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set for Production in Vercel. Without it the new app would go live before its " +
        "migrations, so the build stops here. See supabase/migrations/README.md.",
    );
  }
  // Without these the app could not sign cookies or start sessions; stop before migrating (ADR 0026).
  if ((env.SESSION_SECRET ?? "").length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`SESSION_SECRET is not set for Production in Vercel, or is shorter than ${SESSION_SECRET_MIN_LENGTH} characters. See .env.example.`);
  }
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set for Production in Vercel. See .env.example.");
  }
  return { run: true, databaseUrl: env.DATABASE_URL };
}

export type MigrationFile = { file: string; sql: string };

/** Applies every pending migration and returns the files applied. Holds a lock so two builds cannot overlap. */
export async function applyPending(client: Client, files: MigrationFile[], log: (line: string) => void): Promise<string[]> {
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    const { rows } = await client.query<{ name: string }>(
      "select name from supabase_migrations.schema_migrations where name like 'karaoke\\_%'",
    );
    const pending = pendingMigrations(files.map((f) => f.file), rows.map((r) => r.name));
    const startedAt = new Date();
    for (const [index, file] of pending.entries()) {
      const { sql } = files.find((f) => f.file === file)!;
      log(`Applying ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
          [historyVersion(startedAt, index), historyName(file), [sql]],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file} failed and was rolled back: ${(error as Error).message}`);
      }
    }
    log(pending.length ? `Applied ${pending.length} migration(s).` : "Database is up to date.");
    return pending;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}
