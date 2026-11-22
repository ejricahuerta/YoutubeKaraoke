-- Adding, removing and reordering songs. Runs in a transaction that is rolled back.
begin;

create function pg_temp.queue_titles(p_code text) returns text language sql as $$
  select coalesce(string_agg(item->>'title', ',' order by ord), '')
  from jsonb_array_elements(karaoke.get_state(p_code, null, null)->'queue') with ordinality as q(item, ord);
$$;

create function pg_temp.item_id(p_code text, p_title text) returns uuid language sql as $$
  select i.id from karaoke.queue_items i join karaoke.sessions s on s.id = i.session_id
  where s.code = p_code and i.title = p_title;
$$;

create function pg_temp.add(p_code text, p_guest text, p_title text) returns text language sql as $$
  select karaoke.add_item(p_code, p_guest, p_guest, 'dQw4w9WgXcQ', p_title, 'Channel', '', 200);
$$;

do $$
declare
  v_state jsonb;
begin
  -- Sessions
  assert karaoke.create_session('TEST22', 'host-hash'), 'a new code creates a session';
  assert not karaoke.create_session('TEST22', 'other-hash'), 'a taken code is refused, so the app retries with another';
  assert karaoke.get_state('NOPE22', null, null) is null, 'an unknown code has no state';
  assert (karaoke.get_state('TEST22', 'host-hash', null)->>'isHost')::boolean, 'the host token makes the caller host';
  assert not (karaoke.get_state('TEST22', 'wrong', null)->>'isHost')::boolean, 'any other token does not';
  assert not (karaoke.get_state('TEST22', null, null)->>'isHost')::boolean, 'no token is not host';

  -- Adding
  assert pg_temp.add('NOPE22', 'ana', 'A') = 'not_found', 'cannot add to an unknown session';
  assert karaoke.add_item('TEST22', 'ana', 'Ana', 'bad id', 'A', '', '', 0) = 'invalid', 'a malformed video id is refused';
  assert karaoke.add_item('TEST22', '', 'Ana', 'dQw4w9WgXcQ', 'A', '', '', 0) = 'invalid', 'a guest id is required';
  assert pg_temp.add('TEST22', 'ana', 'A') = 'ok';
  v_state := karaoke.get_state('TEST22', null, 'ana');
  assert v_state->'current'->>'title' = 'A', 'the first song added starts right away';
  assert (v_state->>'isPlaying')::boolean, 'and it plays';
  assert (v_state->'current'->>'mine')::boolean, 'the adder sees it as theirs';
  assert not (karaoke.get_state('TEST22', null, 'ben')->'current'->>'mine')::boolean, 'nobody else does';
  assert pg_temp.add('TEST22', 'ben', 'B') = 'ok';
  assert pg_temp.add('TEST22', 'ana', 'C') = 'ok';
  assert pg_temp.add('TEST22', 'cy', 'D') = 'ok';
  assert pg_temp.queue_titles('TEST22') = 'B,C,D', 'later songs queue in the order they were added';

  assert karaoke.add_item('TEST22', 'dee', '   ', 'dQw4w9WgXcQ', 'E', null, null, -5) = 'ok';
  v_state := karaoke.get_state('TEST22', null, null)->'queue'->3;
  assert v_state->>'addedBy' = 'Guest', 'a blank name becomes Guest';
  assert (v_state->>'durationSeconds')::int = 0, 'a negative length becomes unknown';
  assert karaoke.add_item('TEST22', 'dee', repeat('x', 90), 'dQw4w9WgXcQ', 'F', '', '', 1) = 'ok';
  assert length(karaoke.get_state('TEST22', null, null)->'queue'->4->>'addedBy') = 40, 'names are cut to 40 characters';
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'E'), 'host-hash', '') = 'ok';
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'F'), 'host-hash', '') = 'ok';

  -- Removing
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'B'), null, 'ana') = 'forbidden', 'a guest cannot remove someone else''s song';
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'A'), null, 'ana') = 'forbidden', 'a guest cannot remove their own song once it is playing';
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'C'), null, 'ana') = 'ok', 'a guest can remove their own queued song';
  assert pg_temp.queue_titles('TEST22') = 'B,D';
  assert karaoke.remove_item('TEST22', gen_random_uuid(), 'host-hash', 'x') = 'not_found', 'an unknown song is not found';
  assert karaoke.remove_item('TEST22', pg_temp.item_id('TEST22', 'A'), 'host-hash', 'x') = 'ok', 'the host can remove the playing song';
  assert karaoke.get_state('TEST22', null, null)->'current'->>'title' = 'B', 'which skips to the next one';
  assert pg_temp.queue_titles('TEST22') = 'D';

  -- Reordering
  assert pg_temp.add('TEST22', 'ana', 'E') = 'ok';
  assert pg_temp.add('TEST22', 'ana', 'F') = 'ok';
  assert pg_temp.add('TEST22', 'ana', 'G') = 'ok';
  assert pg_temp.queue_titles('TEST22') = 'D,E,F,G';
  assert karaoke.move_item('TEST22', null, pg_temp.item_id('TEST22', 'G'), null) = 'forbidden', 'only the host reorders';
  assert karaoke.move_item('TEST22', 'wrong', pg_temp.item_id('TEST22', 'G'), null) = 'forbidden';
  assert karaoke.move_item('TEST22', 'host-hash', pg_temp.item_id('TEST22', 'G'), null) = 'ok';
  assert pg_temp.queue_titles('TEST22') = 'G,D,E,F', 'null moves a song to the top';
  assert karaoke.move_item('TEST22', 'host-hash', pg_temp.item_id('TEST22', 'G'), pg_temp.item_id('TEST22', 'E')) = 'ok';
  assert pg_temp.queue_titles('TEST22') = 'D,E,G,F', 'a song moves to just after another';
  assert karaoke.move_item('TEST22', 'host-hash', pg_temp.item_id('TEST22', 'D'), pg_temp.item_id('TEST22', 'F')) = 'ok';
  assert pg_temp.queue_titles('TEST22') = 'E,G,F,D', 'a song moves to the end';
  assert karaoke.move_item('TEST22', 'host-hash', pg_temp.item_id('TEST22', 'B'), null) = 'not_found', 'the playing song cannot be moved';
  assert karaoke.move_item('TEST22', 'host-hash', pg_temp.item_id('TEST22', 'E'), gen_random_uuid()) = 'not_found', 'nor can a song move after an unknown one';
  assert pg_temp.queue_titles('TEST22') = 'E,G,F,D', 'refused moves change nothing';

  -- Repeated moves into the same gap keep a strict order. Each move halves the gap between
  -- two positions, and a double runs out of halves after about fifty.
  for i in 1..200 loop
    assert karaoke.move_item('TEST22', 'host-hash',
      pg_temp.item_id('TEST22', case when i % 2 = 0 then 'G' else 'F' end), pg_temp.item_id('TEST22', 'E')) = 'ok';
    assert pg_temp.queue_titles('TEST22') = case when i % 2 = 0 then 'E,G,F,D' else 'E,F,G,D' end,
      'move ' || i || ' into the same gap lands where it was put';
  end loop;
  assert (select count(distinct position) = count(*) from karaoke.queue_items i
          join karaoke.sessions s on s.id = i.session_id where s.code = 'TEST22' and i.status = 'queued'),
    'no two waiting songs ever share a position';
end $$;

-- The queue is capped at 200 waiting songs.
do $$
begin
  assert karaoke.create_session('FULL22', 'h');
  for i in 1..201 loop
    assert pg_temp.add('FULL22', 'guest' || i, 'S' || i) = 'ok';
  end loop;
  assert pg_temp.add('FULL22', 'newcomer', 'one too many') = 'queue_full', '1 playing + 200 queued is the limit';
end $$;

-- One guest cannot fill the queue: each may have at most 3 songs waiting.
do $$
begin
  assert karaoke.create_session('CAP222', 'host-hash');
  assert pg_temp.add('CAP222', 'ana', 'A1') = 'ok';
  assert karaoke.get_state('CAP222', null, null)->'current'->>'title' = 'A1';
  assert pg_temp.add('CAP222', 'ana', 'A2') = 'ok';
  assert pg_temp.add('CAP222', 'ana', 'A3') = 'ok';
  assert pg_temp.add('CAP222', 'ana', 'A4') = 'ok', 'the song being sung does not count: 3 are waiting now';
  assert pg_temp.add('CAP222', 'ana', 'A5') = 'guest_limit', 'a fourth waiting song is refused';
  assert pg_temp.queue_titles('CAP222') = 'A2,A3,A4', 'and the refused one is not added';
  assert pg_temp.add('CAP222', 'ben', 'B1') = 'ok', 'other guests are not affected';

  -- A2 starts, so only A3 and A4 are waiting.
  assert karaoke.playback('CAP222', 'host-hash', 'next', pg_temp.item_id('CAP222', 'A1')) = 'ok';
  assert pg_temp.add('CAP222', 'ana', 'A5') = 'ok', 'once one of hers is on, she can add again';
  assert pg_temp.add('CAP222', 'ana', 'A6') = 'guest_limit';
  assert karaoke.remove_item('CAP222', pg_temp.item_id('CAP222', 'A5'), null, 'ana') = 'ok';
  assert pg_temp.add('CAP222', 'ana', 'A6') = 'ok', 'removing one of hers makes room too';
end $$;

-- The main screen adds songs for everyone in the room, so the limit is not for it.
do $$
begin
  assert karaoke.create_session('HOST22', 'host-hash');
  for i in 1..6 loop
    assert karaoke.add_item('HOST22', 'tv', 'Host', 'dQw4w9WgXcQ', 'H' || i, '', '', 200, 'host-hash') = 'ok',
      'the main screen may have more than 3 songs waiting';
  end loop;
  assert pg_temp.queue_titles('HOST22') = 'H2,H3,H4,H5,H6';
  assert karaoke.add_item('HOST22', 'tv', 'Host', 'dQw4w9WgXcQ', 'X', '', '', 200, 'wrong-hash') = 'guest_limit',
    'a wrong host token is just a guest';
  assert karaoke.add_item('HOST22', 'tv', 'Host', 'dQw4w9WgXcQ', 'X', '', '', 200) = 'guest_limit',
    'and so is no host token, which is how the app called it before';
end $$;

rollback;
