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
  assert karaoke.set_take_turns('LIFE22', 'host-hash', false) = 'archived';
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

-- Guests can tell when the main screen has gone, and how long before the session closes.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.create_session('AWAY22', 'host-hash');
  v_state := karaoke.get_state('AWAY22', null, 'ana');
  assert (v_state->>'hostAwaySeconds')::int < 5, 'a new session counts its host as just seen';
  assert (v_state->>'closesInSeconds')::int between 895 and 900, 'and closes 15 minutes after the last activity';

  -- The main screen closes; guests keep looking.
  update karaoke.sessions set host_seen_at = now() - interval '5 minutes', last_active_at = now() - interval '5 minutes' where code = 'AWAY22';
  v_state := karaoke.get_state('AWAY22', null, 'ana');
  assert (v_state->>'hostAwaySeconds')::int between 299 and 301, 'guests see how long the main screen has been gone';
  assert (v_state->>'closesInSeconds')::int between 599 and 601, 'and how long until the session closes';

  -- A guest adding a song keeps the session alive, but does not bring the main screen back.
  perform karaoke.add_item('AWAY22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 200);
  v_state := karaoke.get_state('AWAY22', null, 'ana');
  assert (v_state->>'hostAwaySeconds')::int >= 299, 'adding a song is not the main screen';
  assert (v_state->>'closesInSeconds')::int >= 895, 'but it does put off closing';

  -- The main screen comes back: its poll counts as seen at once, even though the session was recently active.
  perform karaoke.get_state('AWAY22', 'host-hash', null);
  v_state := karaoke.get_state('AWAY22', null, 'ana');
  assert (v_state->>'hostAwaySeconds')::int < 5, 'the host poll marks the main screen as seen';

  -- Ended sessions report nothing to count down.
  perform karaoke.end_session('AWAY22', 'host-hash');
  v_state := karaoke.get_state('AWAY22', null, 'ana');
  assert v_state->'hostAwaySeconds' = 'null'::jsonb and v_state->'closesInSeconds' = 'null'::jsonb;
end $$;

-- The 15-minute window is written once.
do $$
begin
  assert karaoke.idle_limit() = interval '15 minutes';
  assert not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'karaoke' and p.proname <> 'idle_limit' and p.prosrc like '%15 minutes%'
  ), 'no other function writes 15 minutes itself';
end $$;

-- The host can end a session on purpose, at once, for everyone.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.create_session('END222', 'host-hash');
  perform karaoke.add_item('END222', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 200);
  perform karaoke.add_item('END222', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B', '', '', 200);

  assert karaoke.end_session('NOPE22', 'host-hash') = 'not_found';
  assert karaoke.end_session('END222', null) = 'forbidden', 'a guest cannot end the session';
  assert karaoke.end_session('END222', 'wrong') = 'forbidden';
  assert not (karaoke.get_state('END222', null, null)->>'archived')::boolean, 'a refused attempt changes nothing';

  assert karaoke.end_session('END222', 'host-hash') = 'ok';
  v_state := karaoke.get_state('END222', null, 'ana');
  assert (v_state->>'archived')::boolean, 'every screen sees it ended';
  assert v_state->'current' = 'null'::jsonb and v_state->'queue' = '[]'::jsonb;
  assert karaoke.add_item('END222', 'ana', 'Ana', 'dQw4w9WgXcQ', 'C', '', '', 200) = 'archived', 'and nobody can add to it';
  assert karaoke.end_session('END222', 'host-hash') = 'archived', 'ending it twice is harmless';

  -- It is cleaned up like any other archived session.
  update karaoke.sessions set archived_at = now() - interval '25 hours' where code = 'END222';
  perform karaoke.cleanup();
  assert not exists (select 1 from karaoke.sessions where code = 'END222');
end $$;

-- Access: the API roles reach the data only through the public functions.
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
      'karaoke.add_item(text, text, text, text, text, text, text, integer, text)',
      'karaoke.remove_item(text, uuid, text, text)', 'karaoke.end_session(text, text)',
      'karaoke.playback(text, text, text, uuid, text)', 'karaoke.move_item(text, text, uuid, uuid, text)',
      'karaoke.set_take_turns(text, text, boolean)'
    ] loop
      assert has_function_privilege(v_role, v_fn, 'execute'), v_role || ' can call ' || v_fn;
    end loop;

    -- Anything else in the schema is an internal helper, including ones added later.
    for v_fn in
      select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'karaoke'
        and p.proname not in ('create_session', 'get_state', 'add_item', 'remove_item', 'move_item', 'playback', 'end_session', 'set_take_turns')
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
