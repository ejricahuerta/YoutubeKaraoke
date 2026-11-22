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
# Applies the migrations the way a production build does, then checks a second run is a no-op.
DATABASE_URL="$url" node scripts/migrate.mts
second_run=$(DATABASE_URL="$url" node scripts/migrate.mts)
case "$second_run" in
  *"Database is up to date."*) ;;
  *) echo "A second migration run should apply nothing, but printed: $second_run" >&2; exit 1 ;;
esac
files=$(ls supabase/migrations/*.sql | wc -l)
entries=$(run -tAc "select count(*) from supabase_migrations.schema_migrations where name like 'karaoke\_%'")
[ "$files" -eq "$entries" ] || { echo "Expected $files karaoke history entries, found $entries" >&2; exit 1; }
for test in supabase/tests/*.test.sql; do
  echo "• $(basename "$test")"
  run -f "$test"
done
echo "Database tests passed."
