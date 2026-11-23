#!/usr/bin/env bash
# Runs the app for real against a real database, the way production runs it, and drives
# it over HTTP (tests/integration, docs/adr/0019). Needs Docker.
#
#   npm run test:integration
#
# Postgres, PostgREST and an nginx that adds Supabase's /rest/v1 prefix run in Docker
# (docker/compose.test.yml). The migrations are applied with the production runner, the
# app is built and started against that API, and the tests act as a main screen and phones.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${INTEGRATION_PORT:-3230}"
compose=(docker compose -f docker/compose.test.yml)

# A fresh secret each run, so nothing secret is committed; the anon key is a JWT signed with it, as on Supabase.
export JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
# The secret key is the same for the service_role role, which alone may start sessions (ADR 0026).
api_key() {
  ROLE="$1" node -e '
    const { createHmac } = require("crypto");
    const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = part({ alg: "HS256", typ: "JWT" }) + "." + part({ role: process.env.ROLE });
    console.log(unsigned + "." + createHmac("sha256", process.env.JWT_SECRET).update(unsigned).digest("base64url"));
  '
}
ANON_KEY="$(api_key anon)"
SECRET_KEY="$(api_key service_role)"

server_pid=""
cleanup() {
  [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "• Starting Postgres, PostgREST and the API proxy"
"${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${compose[@]}" up -d --wait --quiet-pull

echo "• Applying migrations with the production runner"
DATABASE_URL="postgres://postgres@127.0.0.1:54329/postgres" node scripts/migrate.mts
# PostgREST read the schema before the migrations ran.
"${compose[@]}" exec -T db psql -U postgres -qc "notify pgrst, 'reload schema'"
for _ in $(seq 1 30); do
  curl -sf -o /dev/null -H "Accept-Profile: karaoke" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -X POST -H "Content-Type: application/json" -d '{"p_code":"NONE00","p_host_hash":null,"p_guest_id":null}' \
    "http://127.0.0.1:54321/rest/v1/rpc/get_state" && break
  sleep 1
done

echo "• Building and starting the app against it"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY"
SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export SESSION_SECRET
if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "Port $PORT is already in use; stop what is on it or set INTEGRATION_PORT." >&2
  exit 1
fi
npx next build >/dev/null
# Started without npx, so that stopping $server_pid stops the server itself.
node node_modules/next/dist/bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/youoke-integration-server.log" 2>&1 &
server_pid=$!
for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 1; done

echo "• Running tests/integration"
# DATABASE_URL lets a test move a session's clock, e.g. to make the main screen look away.
APP_URL="http://127.0.0.1:$PORT" DATABASE_URL="postgres://postgres@127.0.0.1:54329/postgres" \
  npx vitest run --config vitest.integration.config.mts
