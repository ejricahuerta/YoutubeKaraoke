-- A session lasts an hour at most (migration 0016), whatever is playing or queued and
-- however recently the main screen was seen.
-- Runs in a transaction that is rolled back.
begin;

create function pg_temp.started(p_code text, p_ago interval) returns void language sql as $$
  update karaoke.sessions set created_at = now() - p_ago where code = p_code;
$$;

do $$
declare
  v_state jsonb;
begin
  assert karaoke.create_session('HOUR11', 'host-hash');
  v_state := karaoke.get_state('HOUR11', 'host-hash', null);
  assert (v_state->>'limitInSeconds')::int between 3595 and 3600, 'a new session has an hour left';

  -- A busy session: a song on, more queued, the main screen there, everyone active.
  perform karaoke.add_item('HOUR11', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform karaoke.add_item('HOUR11', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B1', '', '', 200);
  perform pg_temp.started('HOUR11', interval '59 minutes');
  v_state := karaoke.get_state('HOUR11', 'host-hash', null);
  assert not (v_state->>'archived')::boolean, 'just under an hour, it is still on';
  assert (v_state->>'limitInSeconds')::int between 58 and 60, 'a minute left of the hour';
  assert (v_state->>'closesInSeconds')::int between 58 and 60, 'and that is when it closes, though it is busy';

  perform pg_temp.started('HOUR11', interval '1 hour 1 second');
  v_state := karaoke.get_state('HOUR11', 'host-hash', null);
  assert (v_state->>'archived')::boolean, 'an hour after it started, the session has ended';
  assert v_state->'limitInSeconds' = 'null'::jsonb, 'and an ended session has no time left to report';
  assert karaoke.add_item('HOUR11', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A2', '', '', 200) = 'archived',
    'so nothing more can be added';

  -- Sessions nobody touches end on the hour too.
  assert karaoke.create_session('HOUR22', 'host-hash');
  perform karaoke.add_item('HOUR22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform pg_temp.started('HOUR22', interval '61 minutes');
  perform karaoke.cleanup();
  assert (select archived_at is not null from karaoke.sessions where code = 'HOUR22'), 'cleanup ends sessions over an hour old';
end $$;

rollback;
