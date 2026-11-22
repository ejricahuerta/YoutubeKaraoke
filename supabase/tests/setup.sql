-- Makes a plain Postgres look enough like a Supabase project for the migrations to apply:
-- the three API roles and the migration history exist, and nothing of ours is left from
-- an earlier run.
-- (realtime.send and pg_cron are absent; the migrations already treat both as optional.)
set client_min_messages = warning;
drop schema if exists karaoke cascade;
do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      execute format('create role %I nologin', v_role);
    end if;
  end loop;
end $$;

-- Supabase's migration history, which scripts/migrate.mts reads and writes. The row from
-- another app checks that the runner leaves other apps' entries alone.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
delete from supabase_migrations.schema_migrations;
insert into supabase_migrations.schema_migrations (version, name) values ('20200101000000', 'other_app_init');
