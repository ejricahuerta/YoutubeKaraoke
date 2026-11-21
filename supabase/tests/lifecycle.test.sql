-- Archiving after inactivity, deletion a day later, and who may call what.
-- Runs in a transaction that is rolled back.
begin;

do $$
declare
  v_state jsonb;
begin
  assert karaoke.create_session('LIFE22', 'host-hash');
  perform karaoke.add_item('LIFE22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 200);

  -- A guest looking at the session is not activity; the host's screen is.
  update karaoke.sessions set last_active_at = now() - interval '14 minutes' where code = 'LIFE22';
  perform karaoke.get_state('LIFE22', null, 'ana');
  assert (select last_active_at < now() - interval '13 minutes' from karaoke.sessions where code = 'LIFE22'),
    'a guest poll does not keep a session alive';
  perform karaoke.get_state('LIFE22', 'host-hash', null);
  assert (select last_active_at > now() - interval '1 minute' from karaoke.sessions where code = 'LIFE22'),
    'the host poll is the heartbeat';

  -- Adding a song is activity too.
  update karaoke.sessions set last_active_at = now() - interval '14 minutes' where code = 'LIFE22';
  perform karaoke.add_item('LIFE22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B', '', '', 200);
  assert (select last_active_at > now() - interval '1 minute' from karaoke.sessions where code = 'LIFE22');

  -- Fifteen quiet minutes archive the session, checked the moment anyone touches it.
  update karaoke.sessions set last_active_at = now() - interval '16 minutes' where code = 'LIFE22';
  v_state := karaoke.get_state('LIFE22', 'host-hash', 'ana');
  assert (v_state->>'archived')::boolean, 'a stale session reports itself archived, even to its host';
  assert v_state->'current' = 'null'::jsonb and v_state->'queue' = '[]'::jsonb, 'and shows no songs';
  assert (v_state->>'isHost')::boolean, 'the host still learns it was theirs';

  -- Archived is final: every entry point refuses.
  assert karaoke.add_item('LIFE22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'C', '', '', 200) = 'archived';
  assert karaoke.remove_item('LIFE22', gen_random_uuid(), 'host-hash', 'ana') = 'archived';
  assert karaoke.move_item('LIFE22', 'host-hash', gen_random_uuid(), null) = 'archived';
  assert karaoke.playback('LIFE22', 'host-hash', 'play', null) = 'archived';
  update karaoke.sessions set last_active_at = now() where code = 'LIFE22';
  assert (karaoke.get_state('LIFE22', 'host-hash', null)->>'archived')::boolean, 'new activity does not reopen it';

  -- Cleanup archives stale sessions nobody touched and deletes day-old archives with their songs.
  assert karaoke.create_session('IDLE22', 'h');
  update karaoke.sessions set last_active_at = now() - interval '20 minutes' where code = 'IDLE22';
  update karaoke.sessions set archived_at = now() - interval '25 hours' where code = 'LIFE22';
  perform karaoke.cleanup();
  assert (select archived_at is not null from karaoke.sessions where code = 'IDLE22'), 'cleanup archives idle sessions';
  assert not exists (select 1 from karaoke.sessions where code = 'LIFE22'), 'and deletes sessions archived over a day ago';
  assert not exists (select 1 from karaoke.queue_items where title in ('A', 'B')), 'along with their songs';

  -- Creating a session runs the cleanup, so it happens even without pg_cron.
  assert karaoke.create_session('OLD222', 'h');
  update karaoke.sessions set archived_at = now() - interval '25 hours' where code = 'OLD222';
  assert karaoke.create_session('NEW222', 'h');
  assert not exists (select 1 from karaoke.sessions where code = 'OLD222');
end $$;

-- Access: the API roles reach the data only through the six public functions.
do $$
declare
  v_role text;
  v_fn text;
begin
  assert (select bool_and(relrowsecurity) from pg_class where oid in ('karaoke.sessions'::regclass, 'karaoke.queue_items'::regclass)),
    'row level security is on for both tables';
  assert not exists (select 1 from pg_policies where schemaname = 'karaoke'), 'and there are no policies, so no direct access';

  foreach v_role in array array['anon', 'authenticated'] loop
    assert not has_table_privilege(v_role, 'karaoke.sessions', 'select, insert, update, delete'), v_role || ' cannot touch sessions';
    assert not has_table_privilege(v_role, 'karaoke.queue_items', 'select, insert, update, delete'), v_role || ' cannot touch queue items';

    foreach v_fn in array array[
      'karaoke.create_session(text, text)', 'karaoke.get_state(text, text, text)',
      'karaoke.add_item(text, text, text, text, text, text, text, integer)',
      'karaoke.remove_item(text, uuid, text, text)', 'karaoke.move_item(text, text, uuid, uuid)',
      'karaoke.playback(text, text, text, uuid)'
    ] loop
      assert has_function_privilege(v_role, v_fn, 'execute'), v_role || ' can call ' || v_fn;
    end loop;

    -- Anything else in the schema is an internal helper, including ones added later.
    for v_fn in
      select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'karaoke'
        and p.proname not in ('create_session', 'get_state', 'add_item', 'remove_item', 'move_item', 'playback')
    loop
      assert not has_function_privilege(v_role, v_fn, 'execute'), v_role || ' cannot call internal ' || v_fn;
    end loop;
  end loop;

  assert not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'karaoke' and (not p.prosecdef or p.proconfig is null or not 'search_path=""' = any(p.proconfig))
  ), 'every function is security definer with an empty search_path';
end $$;

rollback;
