/**
 * Local database for `npm run dev`: Postgres, PostgREST and the /rest/v1 proxy in Docker
 * (docker/compose.dev.yml). Data is kept between runs. Plain Node, so it runs the same
 * from PowerShell, cmd or bash.
 *
 *   npm run dev:db          start it, apply pending migrations, write .env.local
 *   npm run dev:db -- down  stop it (data kept)
 *   npm run dev:db -- reset stop it and delete its data
 *
 * Realtime is not part of it; screens fall back to polling every 15 s.
 */
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const DB_PORT = process.env.DEV_DB_PORT ?? "54429";
const API_PORT = process.env.DEV_API_PORT ?? "54421";
const SECRETS = path.join(root, "docker", ".env.local");
const ENV_LOCAL = path.join(root, ".env.local");
const compose = ["compose", "-f", path.join(root, "docker", "compose.dev.yml"), "--env-file", SECRETS];

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// One secret per machine, kept in a gitignored file so the anon key stays valid between runs.
if (!existsSync(SECRETS)) writeFileSync(SECRETS, `JWT_SECRET=${randomBytes(32).toString("hex")}\n`);
const secret = readFileSync(SECRETS, "utf8").match(/^JWT_SECRET=(\S+)/m)?.[1];
if (!secret) throw new Error(`No JWT_SECRET in ${SECRETS}; delete the file to make a new one.`);

const action = process.argv[2] ?? "up";
if (action === "down") run("docker", [...compose, "down"]);
else if (action === "reset") run("docker", [...compose, "down", "-v"]);
else if (action !== "up") {
  console.error("Usage: npm run dev:db -- [up|down|reset]");
  process.exit(1);
}
if (action !== "up") process.exit(0);

// The anon key is a JWT signed with the secret, as on Supabase.
const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const apiKey = (role) => {
  const unsigned = `${part({ alg: "HS256", typ: "JWT" })}.${part({ role })}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
};
const anonKey = apiKey("anon");
// The secret key, which alone may start sessions (ADR 0026), and the secret that signs cookies,
// derived from the machine's secret so they stay the same between runs.
const secretKey = apiKey("service_role");
const sessionSecret = createHmac("sha256", secret).update("session-secret").digest("hex");

console.log("• Starting Postgres, PostgREST and the API proxy");
run("docker", [...compose, "up", "-d", "--wait", "--quiet-pull"], { DEV_DB_PORT: DB_PORT, DEV_API_PORT: API_PORT });

console.log("• Applying pending migrations");
// The flag lets Node 22 before 22.18 run .mts files; newer versions do so by default.
run(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join("scripts", "migrate.mts")], {
  DATABASE_URL: `postgres://postgres@127.0.0.1:${DB_PORT}/postgres`,
});
// PostgREST read the schema before the migrations ran.
run("docker", [...compose, "exec", "-T", "db", "psql", "-U", "postgres", "-qc", "notify pgrst, 'reload schema'"]);

const url = `http://127.0.0.1:${API_PORT}`;
if (existsSync(ENV_LOCAL) && !readFileSync(ENV_LOCAL, "utf8").includes(url)) {
  console.log("• .env.local exists and points elsewhere; left as is. Local values:");
  console.log(`  NEXT_PUBLIC_SUPABASE_URL=${url}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
  console.log(`  SUPABASE_SECRET_KEY=${secretKey}`);
  console.log(`  SESSION_SECRET=${sessionSecret}`);
} else {
  writeFileSync(
    ENV_LOCAL,
    `# Local Docker database from scripts/dev-db.mjs. Not the production project.\n` +
      `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}\n` +
      `SUPABASE_SECRET_KEY=${secretKey}\nSESSION_SECRET=${sessionSecret}\n`,
  );
  console.log("• Wrote .env.local");
}

console.log(`Ready. Database: postgres://postgres@127.0.0.1:${DB_PORT}/postgres  API: ${url}`);
