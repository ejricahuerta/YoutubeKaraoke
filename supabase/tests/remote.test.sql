-- The first guest to join a session is its remote: they may play, pause, skip, remove
-- and reorder like the main screen. Runs in a transaction that is rolled back.
begin;

create function pg_temp.item_id(p_code text, p_title text) returns uuid language sql as $$
  select i.id from karaoke.queue_items i join karaoke.sessions s on s.id = i.session_id
  where s.code = p_code and i.title = p_title;
$$;

create function pg_temp.queue_titles(p_code text) returns text language sql as $$
  select coalesce(string_agg(item->>'title', ',' order by ord), '')
  from jsonb_array_elements(karaoke.get_state(p_code, null, null)->'queue') with ordinality as q(item, ord);
$$;

do $$
begin
  assert karaoke.create_session('REMO22', 'host-hash');

  -- The main screen's own browser polls with a guest id too; it never becomes the remote.
  assert not (karaoke.get_state('REMO22', 'host-hash', 'tv')->>'isRemote')::boolean;
  -- Search checks the session with no guest id; that does not count as joining.
  perform karaoke.get_state('REMO22', null, null);

  assert (karaoke.get_state('REMO22', null, 'ana')->>'isRemote')::boolean, 'the first guest to join is the remote';
  assert not (karaoke.get_state('REMO22', null, 'ben')->>'isRemote')::boolean, 'the second is not';
  assert (karaoke.get_state('REMO22', null, 'ana')->>'isRemote')::boolean, 'and the first stays the remote';
  assert not (karaoke.get_state('REMO22', 'host-hash', 'tv')->>'isRemote')::boolean;

  perform karaoke.add_item('REMO22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C1', '', '', 200);
  perform karaoke.add_item('REMO22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B1', '', '', 200);
  perform karaoke.add_item('REMO22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C2', '', '', 200);
  assert pg_temp.queue_titles('REMO22') = 'B1,C2';

  -- Playback
  assert karaoke.playback('REMO22', null, 'pause', null, 'ben') = 'forbidden', 'other guests cannot pause';
  assert karaoke.playback('REMO22', null, 'pause', null, 'ana') = 'ok', 'the remote can';
  assert not (karaoke.get_state('REMO22', null, null)->>'isPlaying')::boolean, 'and everyone sees it paused';
  assert karaoke.playback('REMO22', null, 'play', null, 'ana') = 'ok';
  assert karaoke.playback('REMO22', null, 'next', pg_temp.item_id('REMO22', 'C1'), 'ana') = 'ok', 'the remote can skip';
  assert karaoke.get_state('REMO22', null, null)->'current'->>'title' = 'B1';
  assert karaoke.playback('REMO22', 'host-hash', 'pause', null, 'tv') = 'ok', 'the main screen still can';

  -- The queue
  assert karaoke.move_item('REMO22', null, pg_temp.item_id('REMO22', 'C2'), null, 'ben') = 'forbidden', 'other guests cannot reorder';
  perform karaoke.add_item('REMO22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C3', '', '', 200);
  assert pg_temp.queue_titles('REMO22') = 'C2,C3';
  assert karaoke.move_item('REMO22', null, pg_temp.item_id('REMO22', 'C3'), null, 'ana') = 'ok', 'the remote can';
  assert pg_temp.queue_titles('REMO22') = 'C3,C2';
  assert karaoke.remove_item('REMO22', pg_temp.item_id('REMO22', 'C2'), null, 'ben') = 'forbidden', 'other guests cannot remove someone else''s song';
  assert karaoke.remove_item('REMO22', pg_temp.item_id('REMO22', 'C2'), null, 'ana') = 'ok', 'the remote can';
  assert pg_temp.queue_titles('REMO22') = 'C3';

  -- Ending the session stays with the main screen.
  assert karaoke.end_session('REMO22', null) = 'forbidden';
end $$;

-- Whoever added the song that is playing may skip it, and only that.
do $$
begin
  assert karaoke.create_session('OWNS22', 'host-hash');
  perform karaoke.get_state('OWNS22', null, 'remote-phone');
  perform karaoke.add_item('OWNS22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  perform karaoke.add_item('OWNS22', 'ben', 'Ben', 'dQw4w9WgXcQ', 'B1', '', '', 200);
  assert karaoke.get_state('OWNS22', null, null)->'current'->>'title' = 'A1';

  assert karaoke.playback('OWNS22', null, 'next', pg_temp.item_id('OWNS22', 'A1'), 'ben') = 'forbidden', 'nobody else may skip it';
  assert karaoke.playback('OWNS22', null, 'pause', null, 'ana') = 'forbidden', 'the singer may not pause';
  assert karaoke.playback('OWNS22', null, 'next', pg_temp.item_id('OWNS22', 'A1'), 'ana') = 'ok', 'the singer may skip their own song';
  assert karaoke.get_state('OWNS22', null, null)->'current'->>'title' = 'B1';
  assert karaoke.playback('OWNS22', null, 'next', pg_temp.item_id('OWNS22', 'A1'), 'ana') = 'forbidden', 'and only while it is theirs that is playing';
  assert (karaoke.get_state('OWNS22', null, 'ana')->'current'->>'mine')::boolean is false;
end $$;

-- Without a guest id (p_guest_id defaults to null since migration 0011), only the main screen controls.
do $$
begin
  assert karaoke.create_session('OLDS22', 'host-hash');
  perform karaoke.get_state('OLDS22', null, 'ana');
  perform karaoke.add_item('OLDS22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C1', '', '', 200);
  perform karaoke.add_item('OLDS22', 'cy', 'Cy', 'dQw4w9WgXcQ', 'C2', '', '', 200);
  assert karaoke.playback('OLDS22', 'host-hash', 'pause', null) = 'ok';
  assert karaoke.playback('OLDS22', null, 'pause', null) = 'forbidden';
  assert karaoke.move_item('OLDS22', 'host-hash', (select id from karaoke.queue_items where title = 'C2' and guest_id = 'cy' limit 1), null) = 'ok';
end $$;

-- A session that has ended takes no new remote.
do $$
begin
  assert karaoke.create_session('ENDR22', 'host-hash');
  perform karaoke.end_session('ENDR22', 'host-hash');
  assert not coalesce((karaoke.get_state('ENDR22', null, 'ana')->>'isRemote')::boolean, false);
  assert (select remote_guest_id is null from karaoke.sessions where code = 'ENDR22');
end $$;

-- Handing the remote over (migration 0012). Everyone sees who has it; the main screen, or
-- the remote itself, frees it; then the first phone to ask takes it.
do $$
declare
  v_state jsonb;
begin
  assert karaoke.create_session('HAND22', 'host-hash');
  v_state := karaoke.get_state('HAND22', 'host-hash', 'tv');
  assert v_state->>'remote' = 'unclaimed' and v_state->'remoteName' = 'null'::jsonb, 'nobody has joined yet';

  perform karaoke.get_state('HAND22', null, 'ana');
  v_state := karaoke.get_state('HAND22', null, 'ben');
  assert v_state->>'remote' = 'taken', 'Ana took it by joining first';
  assert v_state->'remoteName' = 'null'::jsonb, 'with no song yet, her name is not known';
  perform karaoke.add_item('HAND22', 'ana', 'Ana', 'dQw4w9WgXcQ', 'A1', '', '', 200);
  assert karaoke.get_state('HAND22', null, 'ben')->>'remoteName' = 'Ana', 'her singer name, once she has added a song';

  -- Only the main screen or the remote itself can free it.
  assert karaoke.free_remote('HAND22', null, 'ben') = 'forbidden', 'another guest cannot';
  assert karaoke.claim_remote('HAND22', 'ben') = 'forbidden', 'nor take a remote someone has';
  assert karaoke.free_remote('HAND22', 'host-hash', null) = 'ok', 'the main screen can';
  v_state := karaoke.get_state('HAND22', null, 'ana');
  assert v_state->>'remote' = 'free' and not (v_state->>'isRemote')::boolean, 'Ana is no longer the remote';
  assert karaoke.playback('HAND22', null, 'pause', null, 'ana') = 'forbidden', 'and has no controls';

  -- Free means nobody until someone asks: joining, or polling, does not take it.
  perform karaoke.get_state('HAND22', null, 'cy');
  assert karaoke.get_state('HAND22', null, 'cy')->>'remote' = 'free';
  assert karaoke.claim_remote('HAND22', '') = 'invalid', 'a guest id is needed';
  assert karaoke.claim_remote('HAND22', 'ben') = 'ok', 'the first phone to ask takes it';
  assert (karaoke.get_state('HAND22', null, 'ben')->>'isRemote')::boolean;
  assert karaoke.claim_remote('HAND22', 'cy') = 'forbidden', 'the next one is too late';
  assert karaoke.playback('HAND22', null, 'pause', null, 'ben') = 'ok', 'Ben now has the controls';

  -- The remote can give it up itself.
  assert karaoke.free_remote('HAND22', null, 'ben') = 'ok';
  assert karaoke.get_state('HAND22', null, 'ben')->>'remote' = 'free';

  assert karaoke.end_session('HAND22', 'host-hash') = 'ok';
  assert karaoke.claim_remote('HAND22', 'cy') = 'archived', 'an ended session hands out nothing';
  assert karaoke.free_remote('HAND22', 'host-hash', null) = 'archived';
  assert karaoke.claim_remote('NOPE22', 'cy') = 'not_found';
end $$;

rollback;
