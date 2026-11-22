/**
 * Applies pending migrations from supabase/migrations.
 *
 *   node scripts/migrate.mts              migrate DATABASE_URL
 *   node scripts/migrate.mts --on-deploy  the build step: only a Vercel production build migrates
 *
 * See scripts/migrations.mts and docs/adr/0015-migrate-on-production-build.md.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { applyPending, deployPlan } from "./migrations.mts";

const DIR = path.join(import.meta.dirname, "..", "supabase", "migrations");
const log = (line: string) => console.log(`[migrate] ${line}`);

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (process.argv.includes("--on-deploy")) {
    const plan = deployPlan(process.env);
    if (!plan.run) return log(`Skipped: ${plan.reason}.`);
    databaseUrl = plan.databaseUrl;
  }
  if (!databaseUrl) throw new Error("Set DATABASE_URL to the database to migrate.");

  const names = await readdir(DIR);
  const files = await Promise.all(
    names.filter((n) => n.endsWith(".sql")).map(async (file) => ({ file, sql: await readFile(path.join(DIR, file), "utf8") })),
  );
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await applyPending(client, files, log);
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  console.error(`[migrate] ${error.message}`);
  process.exit(1);
});
