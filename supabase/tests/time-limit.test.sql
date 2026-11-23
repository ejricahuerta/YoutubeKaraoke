-- A session lasts an hour at most (migration 0016), whatever is playing or queued and
-- however recently the main screen was seen. The browser that started it can start the
-- next one 15 minutes after the hour (migration 0017).
-- Runs in a transaction that is rolled back.
begin;

create function pg_temp.started(p_code text, p_ago interval) returns void language sql as $$
  update karaoke.sessions set created_at = now() - p_ago where code = p_code;
$$;

do $$
declare
  v_state jsonb;
begin
  assert karaoke.start_session('HOUR11', 'host-hash', 'starter-HOUR11', 'net-HOUR11')->>'result' = 'ok';
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
  assert karaoke.start_session('HOUR22', 'host-hash', 'starter-HOUR22', 'net-HOUR22')->>'result' = 'ok';
  perform karaoke.add_item('HOUR22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform pg_temp.started('HOUR22', interval '61 minutes');
  perform karaoke.cleanup();
  assert (select archived_at is not null from karaoke.sessions where code = 'HOUR22'), 'cleanup ends sessions over an hour old';
end $$;

-- After an hour-long session, the browser and the network that started it wait 15 minutes
-- for the next (migration 0017).
do $$
declare
  v_answer jsonb;
begin
  assert karaoke.start_session('WAIT11', 'h1', 'ana', 'net-a')->>'result' = 'ok', 'a browser starts its first session';
  assert (select started_by = 'ana' and started_from = 'net-a' from karaoke.sessions where code = 'WAIT11'),
    'and the session knows which browser and network started it';
  assert karaoke.start_session('WAIT11', 'h2', 'ben', 'net-b')->>'result' = 'taken', 'a code in use cannot be started again';
  assert karaoke.start_session('WAIT12', 'h2', '', 'net-x')->>'result' = 'invalid', 'starting needs a browser';
  assert karaoke.start_session('WAIT12', 'h2', 'dan', '')->>'result' = 'invalid', 'and a network';

  -- Ana's session reaches its hour two minutes ago.
  perform pg_temp.started('WAIT11', interval '62 minutes');
  v_answer := karaoke.start_session('WAIT13', 'h3', 'ana', 'net-a');
  assert v_answer->>'result' = 'wait', 'right after its hour, the same browser cannot start another';
  assert (v_answer->>'waitSeconds')::int between 778 and 780, 'and is told it can in 13 minutes';
  assert not exists (select 1 from karaoke.sessions where code = 'WAIT13'), 'and nothing is created';
  assert (select archived_at is not null from karaoke.sessions where code = 'WAIT11'), 'the old session has ended';
  assert karaoke.start_session('WAIT14', 'h4', 'ben', 'net-b')->>'result' = 'ok', 'other browsers on other networks are not held up';
  assert karaoke.start_session('WAIT16', 'h9', 'private-window', 'net-a')->>'result' = 'wait',
    'a new browser on the same network waits too: clearing cookies does not skip it';
  assert karaoke.start_session('WAIT17', 'h9', 'ana', 'phone-data')->>'result' = 'wait',
    'and the same browser on another network waits too';

  perform pg_temp.started('WAIT11', interval '75 minutes 1 second');
  assert karaoke.start_session('WAIT15', 'h5', 'ana', 'net-a')->>'result' = 'ok', '15 minutes after the hour, it can';

  -- A session ended before its hour, by the main screen or by being idle, means no wait.
  assert karaoke.start_session('EARLY1', 'h6', 'cy', 'net-c')->>'result' = 'ok';
  assert karaoke.end_session('EARLY1', 'h6') = 'ok';
  assert karaoke.start_session('EARLY2', 'h7', 'cy', 'net-c')->>'result' = 'ok', 'ending a session early does not make anyone wait';
  -- Ten minutes long, it ended an hour ago.
  update karaoke.sessions set created_at = now() - interval '70 minutes', archived_at = now() - interval '60 minutes'
    where code = 'EARLY1';
  assert karaoke.start_session('EARLY3', 'h8', 'cy', 'net-c')->>'result' = 'ok', 'even once the hour it would have had is over';
end $$;

-- Only the server can start a session: the publishable key cannot skip the wait.
do $$
begin
  assert not has_function_privilege('anon', 'karaoke.start_session(text, text, text, text)', 'execute'), 'anon cannot start sessions';
  assert not has_function_privilege('authenticated', 'karaoke.start_session(text, text, text, text)', 'execute');
  assert has_function_privilege('service_role', 'karaoke.start_session(text, text, text, text)', 'execute'), 'the server, with its secret key, can';
end $$;

rollback;
