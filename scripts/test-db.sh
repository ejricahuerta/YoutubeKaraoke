#!/usr/bin/env bash
# Runs the database tests in supabase/tests against a throwaway Postgres.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# It drops and recreates the "karaoke" schema, so it refuses anything but a local server.
set -euo pipefail
cd "$(dirname "$0")/.."

url="${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a local, disposable Postgres database}"
case "$url" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|*host=localhost*|*host=/*) ;;
  *) echo "Refusing to run: TEST_DATABASE_URL must point at localhost, because the karaoke schema is dropped." >&2; exit 1 ;;
esac

run() { psql "$url" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"; }

run -f supabase/tests/setup.sql
for migration in supabase/migrations/*.sql; do
  run -f "$migration"
done
for test in supabase/tests/*.test.sql; do
  echo "• $(basename "$test")"
  run -f "$test"
done
echo "Database tests passed."
