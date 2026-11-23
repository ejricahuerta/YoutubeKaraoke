-- What happens when the main screen goes away (migration 0014): it pauses, phones are told,
-- the session ends 15 minutes later, and the remote can move the main screen to another
-- device. And an open main screen with nothing to play ends after 30 idle minutes.
-- Runs in a transaction that is rolled back.
begin;

create function pg_temp.item_id(p_code text, p_title text) returns uuid language sql as $$
  select i.id from karaoke.queue_items i join karaoke.sessions s on s.id = i.session_id
  where s.code = p_code and i.title = p_title;
$$;

create function pg_temp.away(p_code text, p_for interval) returns void language sql as $$
  update karaoke.sessions set host_seen_at = now() - p_for where code = p_code;
$$;

-- Away: paused, said so, phones cannot play, guests can still add.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.start_session('GONE22', 'host-hash', 'starter-GONE22', 'net-GONE22')->>'result' = 'ok';
  perform karaoke.get_state('GONE22', null, 'ana'); -- Ana is the remote
  perform karaoke.add_item('GONE22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform karaoke.add_item('GONE22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B1', '', '', 200);
  v_state := karaoke.get_state('GONE22', null, 'ben');
  assert not (v_state->>'mainScreenAway')::boolean and (v_state->>'isPlaying')::boolean, 'with the main screen there, it plays';

  perform pg_temp.away('GONE22', interval '2 minutes');
  assert not (karaoke.get_state('GONE22', null, 'ben')->>'mainScreenAway')::boolean, 'two minutes is a normal gap between heartbeats';

  perform pg_temp.away('GONE22', interval '3 minutes');
  v_state := karaoke.get_state('GONE22', null, 'ben');
  assert (v_state->>'mainScreenAway')::boolean, 'after 150 seconds the main screen is away';
  assert not (v_state->>'isPlaying')::boolean, 'and nothing is playing, so the session says so';
  assert not (select is_playing from karaoke.sessions where code = 'GONE22'), 'paused for when it comes back';

  assert karaoke.playback('GONE22', null, 'play', null, 'ana') = 'main_screen_away', 'the remote cannot play with no screen to play on';
  assert karaoke.playback('GONE22', null, 'next', pg_temp.item_id('GONE22', 'A1'), 'ana') = 'main_screen_away', 'nor skip';
  assert karaoke.play_item('GONE22', null, pg_temp.item_id('GONE22', 'B1'), pg_temp.item_id('GONE22', 'A1'), 'ana') = 'main_screen_away',
    'nor play a picked song (migration 0015)';
  assert karaoke.add_item('GONE22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C1', '', '', 200) = 'ok', 'guests can still add songs for later';

  -- The main screen comes back: it is no longer away, and stays paused until someone plays.
  v_state := karaoke.get_state('GONE22', 'host-hash', null);
  assert not (v_state->>'mainScreenAway')::boolean and not (v_state->>'isPlaying')::boolean;
  assert karaoke.playback('GONE22', null, 'play', null, 'ana') = 'ok', 'the remote works again';
end $$;

-- The session ends 15 minutes after the main screen was last seen, whatever guests do.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.start_session('ENDS22', 'host-hash', 'starter-ENDS22', 'net-ENDS22')->>'result' = 'ok';
  perform karaoke.add_item('ENDS22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform pg_temp.away('ENDS22', interval '14 minutes');
  perform karaoke.add_item('ENDS22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A2', '', '', 200);
  v_state := karaoke.get_state('ENDS22', null, 'ana');
  assert (v_state->>'closesInSeconds')::int between 58 and 60, 'adding a song does not put it off';
  perform pg_temp.away('ENDS22', interval '15 minutes 1 second');
  assert (karaoke.get_state('ENDS22', null, 'ana')->>'archived')::boolean, 'then it ends, for everyone';
end $$;

-- An open main screen with nothing playing and nothing queued ends after 30 idle minutes.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.start_session('IDLE33', 'host-hash', 'starter-IDLE33', 'net-IDLE33')->>'result' = 'ok';
  update karaoke.sessions set last_active_at = now() - interval '29 minutes' where code = 'IDLE33';
  v_state := karaoke.get_state('IDLE33', 'host-hash', null);
  assert not (v_state->>'archived')::boolean;
  assert (v_state->>'closesInSeconds')::int between 58 and 60, 'idle, it closes 30 minutes after the last activity';
  update karaoke.sessions set last_active_at = now() - interval '31 minutes' where code = 'IDLE33';
  assert (karaoke.get_state('IDLE33', 'host-hash', null)->>'archived')::boolean, 'even with the main screen open';

  -- A song waiting or playing is not idle, however long ago anything happened.
  assert karaoke.start_session('BUSY33', 'host-hash', 'starter-BUSY33', 'net-BUSY33')->>'result' = 'ok';
  perform karaoke.add_item('BUSY33', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  update karaoke.sessions set last_active_at = now() - interval '2 hours' where code = 'BUSY33';
  v_state := karaoke.get_state('BUSY33', 'host-hash', null);
  assert not (v_state->>'archived')::boolean, 'a song on is not idle';
  assert (v_state->>'closesInSeconds')::int between 895 and 900, 'so only the main screen''s 15 minutes count';

  -- The cleanup follows the same rules.
  assert karaoke.start_session('IDLE44', 'host-hash', 'starter-IDLE44', 'net-IDLE44')->>'result' = 'ok';
  update karaoke.sessions set last_active_at = now() - interval '31 minutes' where code = 'IDLE44';
  perform pg_temp.away('BUSY33', interval '16 minutes');
  perform karaoke.cleanup();
  assert (select archived_at is not null from karaoke.sessions where code = 'IDLE44'), 'cleanup ends idle sessions';
  assert (select archived_at is not null from karaoke.sessions where code = 'BUSY33'), 'and ones the main screen left';
end $$;

-- Moving the main screen: the remote, while it is away, gets a one-time link for another device.
do $$
begin
  assert karaoke.start_session('MOVE22', 'old-host', 'starter-MOVE22', 'net-MOVE22')->>'result' = 'ok';
  perform karaoke.get_state('MOVE22', null, 'ana'); -- Ana is the remote

  assert karaoke.start_handoff('MOVE22', 'ana', 'link-1') = 'main_screen_here', 'not while the main screen is there';
  perform pg_temp.away('MOVE22', interval '3 minutes');
  assert karaoke.start_handoff('MOVE22', 'ben', 'link-1') = 'forbidden', 'only the remote can';
  assert karaoke.start_handoff('MOVE22', '', 'link-1') = 'forbidden';
  assert karaoke.start_handoff('MOVE22', 'ana', 'link-1') = 'ok';
  assert karaoke.start_handoff('MOVE22', 'ana', 'link-2') = 'ok', 'a new link replaces the last';

  assert karaoke.take_over('MOVE22', 'link-1', 'new-host') = 'forbidden', 'the replaced link no longer works';
  assert karaoke.take_over('MOVE22', 'wrong', 'new-host') = 'forbidden';
  assert karaoke.take_over('MOVE22', 'link-2', 'new-host') = 'ok', 'the current one does';
  assert (karaoke.get_state('MOVE22', 'new-host', null)->>'isHost')::boolean, 'the new device is the main screen';
  assert not (karaoke.get_state('MOVE22', 'old-host', null)->>'isHost')::boolean, 'the old one is not';
  assert not (karaoke.get_state('MOVE22', null, 'ana')->>'mainScreenAway')::boolean, 'and it is not away any more';
  assert karaoke.take_over('MOVE22', 'link-2', 'third') = 'forbidden', 'a link works once';

  -- A link expires after 10 minutes.
  perform pg_temp.away('MOVE22', interval '3 minutes');
  assert karaoke.start_handoff('MOVE22', 'ana', 'link-3') = 'ok';
  update karaoke.sessions set handoff_expires_at = now() - interval '1 second' where code = 'MOVE22';
  assert karaoke.take_over('MOVE22', 'link-3', 'third') = 'forbidden', 'an expired link does not work';

  -- If the main screen came back in the meantime, the link is refused.
  assert karaoke.start_handoff('MOVE22', 'ana', 'link-4') = 'ok';
  perform karaoke.get_state('MOVE22', 'new-host', null);
  assert karaoke.take_over('MOVE22', 'link-4', 'third') = 'main_screen_here';
  assert (karaoke.get_state('MOVE22', 'new-host', null)->>'isHost')::boolean, 'the screen that came back keeps it';

  assert karaoke.end_session('MOVE22', 'new-host') = 'ok';
  assert karaoke.start_handoff('MOVE22', 'ana', 'link-5') = 'archived';
  assert karaoke.take_over('MOVE22', 'link-5', 'third') = 'archived';
  assert karaoke.take_over('NOPE22', 'link-5', 'third') = 'not_found';
end $$;

rollback;
