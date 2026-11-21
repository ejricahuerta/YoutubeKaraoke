-- Makes a plain Postgres look enough like a Supabase project for the migrations to apply:
-- the three API roles exist, and nothing of ours is left from an earlier run.
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
