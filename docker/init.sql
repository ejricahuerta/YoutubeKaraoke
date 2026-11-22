-- Makes a fresh Postgres look like a Supabase project, enough for the app to run on it:
-- the API roles, the role PostgREST logs in as, and the migration history table that
-- scripts/migrate.mts writes. Runs once, when the database container is created.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
-- PostgREST connects as this role and switches to anon for each request, as Supabase does.
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
