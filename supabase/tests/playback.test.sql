-- Play, pause and next. Runs in a transaction that is rolled back.
begin;

do $$
declare
  v_a uuid;
  v_b uuid;
begin
  assert karaoke.create_session('PLAY22', 'host-hash');
  perform karaoke.add_item('PLAY22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 200);
  perform karaoke.add_item('PLAY22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B', '', '', 200);
  select id into v_a from karaoke.queue_items where title = 'A';
  select id into v_b from karaoke.queue_items where title = 'B';

  assert karaoke.playback('NOPE22', 'host-hash', 'pause', null) = 'not_found';
  assert karaoke.playback('PLAY22', null, 'pause', null) = 'forbidden', 'guests cannot pause';
  assert karaoke.playback('PLAY22', 'wrong', 'next', v_a) = 'forbidden', 'or skip';
  assert karaoke.playback('PLAY22', 'host-hash', 'rewind', null) = 'invalid';

  assert karaoke.playback('PLAY22', 'host-hash', 'pause', null) = 'ok';
  assert not (karaoke.get_state('PLAY22', null, null)->>'isPlaying')::boolean, 'pause is visible to everyone';
  assert karaoke.playback('PLAY22', 'host-hash', 'play', null) = 'ok';
  assert (karaoke.get_state('PLAY22', null, null)->>'isPlaying')::boolean;

  -- "next" names the song the host believes is playing, so a repeated call cannot skip two.
  assert karaoke.playback('PLAY22', 'host-hash', 'pause', null) = 'ok';
  assert karaoke.playback('PLAY22', 'host-hash', 'next', v_a) = 'ok';
  assert karaoke.get_state('PLAY22', null, null)->'current'->>'title' = 'B', 'next moves to the following song';
  assert (karaoke.get_state('PLAY22', null, null)->>'isPlaying')::boolean, 'and starts it even if the last one was paused';
  assert karaoke.playback('PLAY22', 'host-hash', 'next', v_a) = 'stale', 'the same next again is a no-op';
  assert karaoke.get_state('PLAY22', null, null)->'current'->>'title' = 'B';

  assert karaoke.playback('PLAY22', 'host-hash', 'next', v_b) = 'ok';
  assert karaoke.get_state('PLAY22', null, null)->'current' = 'null'::jsonb, 'after the last song nothing is playing';
  assert karaoke.playback('PLAY22', 'host-hash', 'next', null) = 'ok', 'next with nothing playing is harmless';

  perform karaoke.add_item('PLAY22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'C', '', '', 200);
  assert karaoke.get_state('PLAY22', null, null)->'current'->>'title' = 'C', 'a song added to an empty session starts';
end $$;

-- What has been sung tonight: finished songs, newest first, for every screen.
do $$
declare
  v_state jsonb;
  v_ids uuid[];
begin
  assert karaoke.create_session('SUNG22', 'host-hash');
  assert jsonb_array_length(karaoke.get_state('SUNG22', null, null)->'played') = 0, 'a new session has sung nothing';
  perform karaoke.add_item('SUNG22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', 'Chan', '', 200);
  perform karaoke.add_item('SUNG22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B', 'Chan', '', 210);
  perform karaoke.add_item('SUNG22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C', 'Chan', '', 220);
  perform karaoke.add_item('SUNG22', 'dee', 'Dee', 'dQw4w9WgXcQ', 'D', 'Chan', '', 230);

  -- The host plays D right after A, so finishing order differs from adding order.
  perform karaoke.move_item('SUNG22', 'host-hash', (select id from karaoke.queue_items where title = 'D'), null);
  for i in 1..3 loop
    perform karaoke.playback('SUNG22', 'host-hash', 'next', (select current_item_id from karaoke.sessions where code = 'SUNG22'));
  end loop;

  v_state := karaoke.get_state('SUNG22', null, 'ana');
  assert v_state->'current'->>'title' = 'C';
  assert (select string_agg(p->>'title', ',' order by o) from jsonb_array_elements(v_state->'played') with ordinality as x(p, o)) = 'B,D,A',
    'finished songs, newest first, in the order they were actually sung';
  assert v_state->'played'->2->>'addedBy' = 'Ana' and (v_state->'played'->2->>'mine')::boolean, 'each says who sang it and whether it was mine';
  assert not (v_state->'played'->0->>'mine')::boolean;
  assert (v_state->'played'->0->>'durationSeconds')::int = 210 and v_state->'played'->0->>'videoId' = 'dQw4w9WgXcQ',
    'with what is needed to add it again';
  assert v_state->'queue' = '[]'::jsonb, 'the queue still holds only waiting songs';

  -- The list is capped so the state stays small on a long night.
  for i in 1..60 loop
    perform karaoke.add_item('SUNG22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'S' || i, '', '', 200);
    perform karaoke.playback('SUNG22', 'host-hash', 'next', (select current_item_id from karaoke.sessions where code = 'SUNG22'));
  end loop;
  v_state := karaoke.get_state('SUNG22', null, null);
  assert jsonb_array_length(v_state->'played') = 50, 'at most 50 finished songs are sent';
  assert v_state->'played'->0->>'title' = 'S59', 'the newest ones';

  -- An ended session shows nothing, as before.
  perform karaoke.end_session('SUNG22', 'host-hash');
  assert karaoke.get_state('SUNG22', null, null)->'played' = '[]'::jsonb;
end $$;

-- The host picks any waiting song to play now: the one being sung ends and the pick starts.
do $$
declare
  v_a uuid;
  v_c uuid;
  v_d uuid;
  v_state jsonb;
begin
  assert karaoke.create_session('PICK22', 'host-hash');
  perform karaoke.get_state('PICK22', null, 'remo'); -- the first guest to look is the remote
  perform karaoke.add_item('PICK22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 200);
  perform karaoke.add_item('PICK22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B', '', '', 200);
  perform karaoke.add_item('PICK22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C', '', '', 200);
  perform karaoke.add_item('PICK22', 'dee', 'Dee', 'dQw4w9WgXcQ', 'D', '', '', 200);
  select id into v_a from karaoke.queue_items where title = 'A' and session_id = (select id from karaoke.sessions where code = 'PICK22');
  select id into v_c from karaoke.queue_items where title = 'C' and session_id = (select id from karaoke.sessions where code = 'PICK22');
  select id into v_d from karaoke.queue_items where title = 'D' and session_id = (select id from karaoke.sessions where code = 'PICK22');

  assert karaoke.play_item('NOPE22', 'host-hash', v_c, v_a) = 'not_found';
  assert karaoke.play_item('PICK22', null, v_c, v_a, 'ben') = 'forbidden', 'a guest cannot pick what plays';
  assert karaoke.play_item('PICK22', 'wrong', v_c, v_a) = 'forbidden';
  assert karaoke.play_item('PICK22', 'host-hash', v_c, v_d) = 'stale', 'the pick names the song it interrupts';
  assert karaoke.play_item('PICK22', 'host-hash', gen_random_uuid(), v_a) = 'not_found', 'only a waiting song can be picked';
  assert karaoke.play_item('PICK22', 'host-hash', v_a, v_a) = 'not_found', 'not the one being sung';
  assert karaoke.get_state('PICK22', null, null)->'current'->>'title' = 'A', 'a refused pick changes nothing';

  assert karaoke.playback('PICK22', 'host-hash', 'pause', null) = 'ok';
  assert karaoke.play_item('PICK22', 'host-hash', v_c, v_a) = 'ok';
  v_state := karaoke.get_state('PICK22', null, null);
  assert v_state->'current'->>'title' = 'C', 'the picked song plays now';
  assert (v_state->>'isPlaying')::boolean, 'even if the last one was paused';
  assert (select string_agg(q->>'title', ',' order by o) from jsonb_array_elements(v_state->'queue') with ordinality as x(q, o)) = 'B,D',
    'the rest keep their order';
  assert v_state->'played'->0->>'title' = 'A', 'and the interrupted song counts as sung';
  assert karaoke.play_item('PICK22', 'host-hash', v_c, v_a) = 'stale', 'pressing again does nothing more';

  assert karaoke.play_item('PICK22', null, v_d, v_c, 'remo') = 'ok', 'the phone remote may pick too';
  assert karaoke.get_state('PICK22', null, null)->'current'->>'title' = 'D';

  -- Songs in other sessions are out of reach.
  assert karaoke.create_session('OTHR22', 'other-hash');
  perform karaoke.add_item('OTHR22', 'eve', 'Eve', 'dQw4w9WgXcQ', 'E', '', '', 200);
  perform karaoke.add_item('OTHR22', 'fay', 'Fay', 'dQw4w9WgXcQ', 'F', '', '', 200);
  assert karaoke.play_item('PICK22', 'host-hash', (select id from karaoke.queue_items where title = 'F'), v_d) = 'not_found';
end $$;

rollback;
