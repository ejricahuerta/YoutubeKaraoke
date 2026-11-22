-- The start page's recently sung songs. Runs in a transaction that is rolled back.
begin;

do $$
declare
  v_a uuid;
  v_b uuid;
begin
  -- Other test files leave nothing behind, but start from a clean slate anyway.
  delete from karaoke.sessions;
  assert karaoke.recently_played() = '{}'::text[], 'with nothing sung there is nothing to show';

  assert karaoke.create_session('RCNT22', 'host-hash');
  perform karaoke.add_item('RCNT22', 'ana', 'Ana', 'aaaaaaaaaaa', 'A', '', '', 200);
  perform karaoke.add_item('RCNT22', 'ben', 'Ben', 'bbbbbbbbbbb', 'B', '', '', 200);
  perform karaoke.add_item('RCNT22', 'cy', 'Cy', 'ccccccccccc', 'C', '', '', 200);
  select id into v_a from karaoke.queue_items where title = 'A';
  select id into v_b from karaoke.queue_items where title = 'B';
  assert karaoke.recently_played() = '{}'::text[], 'a song playing or waiting is not yet sung';

  perform karaoke.playback('RCNT22', 'host-hash', 'next', v_a);
  perform karaoke.playback('RCNT22', 'host-hash', 'next', v_b);
  assert karaoke.recently_played() = array['bbbbbbbbbbb', 'aaaaaaaaaaa'], 'sung songs, newest first, as video ids only';

  -- Another session sings A again: it shows once, as the newest.
  assert karaoke.create_session('RCNT33', 'other-hash');
  perform karaoke.add_item('RCNT33', 'dee', 'Dee', 'aaaaaaaaaaa', 'A again', '', '', 200);
  perform karaoke.playback('RCNT33', 'other-hash', 'next', (select id from karaoke.queue_items where title = 'A again'));
  assert karaoke.recently_played() = array['aaaaaaaaaaa', 'bbbbbbbbbbb'], 'each video once, from every session';

  -- Only the last day counts.
  update karaoke.queue_items set played_at = now() - interval '25 hours' where video_id = 'bbbbbbbbbbb';
  assert karaoke.recently_played() = array['aaaaaaaaaaa'], 'songs sung over a day ago are left out';

  -- At most 24.
  for i in 1..30 loop
    perform karaoke.add_item('RCNT22', 'ana', 'Ana', lpad(i::text, 11, 'x'), 'Many ' || i, '', '', 200);
  end loop;
  update karaoke.queue_items set status = 'played', played_at = clock_timestamp() where title like 'Many %';
  assert cardinality(karaoke.recently_played()) = 24, 'the list is capped';
end $$;

rollback;
