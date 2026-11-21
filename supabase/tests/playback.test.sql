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

rollback;
