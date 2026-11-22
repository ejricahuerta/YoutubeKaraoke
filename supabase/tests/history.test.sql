-- scripts/migrate.mts kept the SQL it ran in each history entry and left other apps' entries
-- alone. (scripts/test-db.sh checks there is one entry per file.)
do $$
begin
  assert exists (select 1 from supabase_migrations.schema_migrations where name = 'karaoke_init'
                   and statements[1] like '%create schema%karaoke%'), 'an entry keeps the SQL it ran';
  assert exists (select 1 from supabase_migrations.schema_migrations where name = 'other_app_init'), 'other apps keep their entries';
end $$;
