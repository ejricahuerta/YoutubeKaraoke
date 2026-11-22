-- Singers take turns (issue #21).
--
-- Songs used to play strictly in the order they were added, so one keen guest could
-- queue ten songs and keep everyone else waiting. Now a new song goes after the last
-- waiting song of its singer's round: a singer's first waiting or current song is
-- round 1, their second round 2, and so on. Each singer gets one song per round:
--
--   added:   Ana1 Ana2 Ana3 Ben1 Cy1 Ben2
--   played:  Ana1 Ben1 Cy1 Ana2 Ben2 Ana3
--
-- Only waiting and current songs count, not ones sung earlier tonight. Songs keep an
-- explicit position, so the main screen and the remote can still move any song
-- anywhere; later songs fit around what they did.
--
-- Who the singer is: a guest's phone (its guest id), whatever name it types, so renaming
-- does not buy a new first turn. The main screen adds for people without a phone under
-- one browser, so its songs belong to the name typed, in any case.
--
-- Also: the placing logic moves out of move_item into karaoke.place_item, shared with
-- add_item. The host-only playback and move_item signatures that 0010 kept for the app
-- deployed then are dropped (the live app uses the ones with p_guest_id), and
-- p_guest_id now defaults to null, so a call without it is a call without a guest.

alter table karaoke.queue_items add column singer text;
update karaoke.queue_items set singer = 'guest:' || guest_id where singer is null;
alter table karaoke.queue_items alter column singer set not null;

-- Internal: puts a waiting song right after p_after_id, or first when that is null.
-- Returns false when either song is not waiting in that session. Positions are doubles;
-- a move halves the gap between two neighbours, and when that gap is too small every
-- waiting song is renumbered 1, 2, 3, ... first.
create function karaoke.place_item(p_session_id uuid, p_item_id uuid, p_after_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  -- Far above where a double near 200 loses precision, so there is always room to halve again.
  c_min_gap constant double precision := 1e-6;
  v_prev double precision;
  v_next double precision;
  v_attempt integer;
begin
  -- At most two passes: the second only after renumbering, when every gap is 1.
  for v_attempt in 1..2 loop
    v_prev := null;
    if p_after_id is not null then
      select position into v_prev from karaoke.queue_items
        where id = p_after_id and session_id = p_session_id and status = 'queued';
      if not found then
        return false;
      end if;
    end if;
    select min(position) into v_next from karaoke.queue_items
      where session_id = p_session_id and status = 'queued' and id <> p_item_id
        and (v_prev is null or position > v_prev);

    exit when v_prev is null or v_next is null or v_next - v_prev >= c_min_gap;

    update karaoke.queue_items q set position = r.place
      from (
        select id, row_number() over (order by position, created_at, id) as place
        from karaoke.queue_items
        where session_id = p_session_id and status = 'queued'
      ) r
      where q.id = r.id;
  end loop;

  update karaoke.queue_items
    set position = case
      when v_prev is null and v_next is null then position
      when v_prev is null then v_next - 1
      when v_next is null then v_prev + 1
      else (v_prev + v_next) / 2 end
    where id = p_item_id and session_id = p_session_id and status = 'queued';
  return found;
end $$;
revoke execute on function karaoke.place_item(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function karaoke.add_item(
  p_code text, p_guest_id text, p_name text, p_video_id text, p_title text,
  p_channel text, p_thumbnail_url text, p_duration_seconds integer, p_host_hash text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Both mirrored in lib/domain/singers.ts for what guests see.
  c_max_waiting_per_guest constant integer := 3;  -- MAX_WAITING_SONGS
  c_people_before_limit constant integer := 3;    -- PEOPLE_BEFORE_SONG_LIMIT
  v_session karaoke.sessions;
  v_is_host boolean;
  v_name text;
  v_singer text;
  v_round integer;
  v_item_id uuid;
  v_after_id uuid;
begin
  select * into v_session from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session.id) then
    return 'archived';
  end if;
  if p_video_id !~ '^[A-Za-z0-9_-]{11}$' or coalesce(p_guest_id, '') = '' then
    return 'invalid';
  end if;
  if (select count(*) from karaoke.queue_items
        where session_id = v_session.id and status = 'queued') >= 200 then
    return 'queue_full';
  end if;
  v_is_host := p_host_hash is not null and v_session.host_token_hash = p_host_hash;
  -- One guest cannot fill the queue, once there are enough people for it to matter: the
  -- cap applies only when at least 3 different guests have a song waiting or being sung.
  -- The caller's own song on stage does not count towards their 3, only waiting ones.
  -- The main screen adds for the whole room, so it is never held to this.
  if not v_is_host
     and (select count(*) from karaoke.queue_items
            where session_id = v_session.id and status = 'queued' and guest_id = p_guest_id) >= c_max_waiting_per_guest
     and (select count(distinct guest_id) from karaoke.queue_items
            where session_id = v_session.id and status in ('queued', 'playing')) >= c_people_before_limit then
    return 'guest_limit';
  end if;

  v_name := left(coalesce(nullif(btrim(p_name), ''), 'Guest'), 40);
  v_singer := case when v_is_host then 'name:' || lower(v_name) else 'guest:' || p_guest_id end;
  -- This song's round: one more than the singer's songs already waiting or on stage.
  select count(*) + 1 into v_round from karaoke.queue_items
    where session_id = v_session.id and status in ('queued', 'playing') and singer = v_singer;

  insert into karaoke.queue_items
    (session_id, video_id, title, channel, thumbnail_url, duration_seconds, added_by_name, guest_id, singer, position)
  values
    (v_session.id, p_video_id, left(p_title, 300), left(coalesce(p_channel, ''), 200),
     left(coalesce(p_thumbnail_url, ''), 500), greatest(coalesce(p_duration_seconds, 0), 0),
     v_name, p_guest_id, v_singer,
     (select coalesce(max(position), 0) + 1 from karaoke.queue_items where session_id = v_session.id))
  returning id into v_item_id;

  -- It goes after the last waiting song whose round is no later than its own. A waiting
  -- song's round is its place among its singer's waiting songs, plus one if that singer
  -- is on stage now. With none, it goes first.
  select r.id into v_after_id from (
    select q.id, q.position,
           row_number() over (partition by q.singer order by q.position)
             + case when q.singer = c.singer then 1 else 0 end as round
    from karaoke.queue_items q
    left join karaoke.queue_items c on c.id = v_session.current_item_id
    where q.session_id = v_session.id and q.status = 'queued' and q.id <> v_item_id
  ) r
  where r.round <= v_round
  order by r.position desc
  limit 1;
  perform karaoke.place_item(v_session.id, v_item_id, v_after_id);

  perform karaoke.ensure_current(v_session.id);
  update karaoke.sessions set last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

drop function karaoke.move_item(text, text, uuid, uuid);
drop function karaoke.playback(text, text, text, uuid);

create or replace function karaoke.move_item(
  p_code text, p_host_hash text, p_item_id uuid, p_after_id uuid, p_guest_id text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
begin
  select * into v_session from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session.id) then
    return 'archived';
  end if;
  if not karaoke.can_control(v_session, p_host_hash, p_guest_id) then
    return 'forbidden';
  end if;
  if not karaoke.place_item(v_session.id, p_item_id, p_after_id) then
    return 'not_found';
  end if;
  update karaoke.sessions set last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

create or replace function karaoke.playback(
  p_code text, p_host_hash text, p_action text, p_expected_item_id uuid, p_guest_id text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
  v_skipping_own_song boolean;
begin
  select * into v_session from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session.id) then
    return 'archived';
  end if;
  -- Whoever added the song being sung may skip it, and do nothing else.
  v_skipping_own_song := p_action = 'next' and coalesce(p_guest_id, '') <> '' and exists (
    select 1 from karaoke.queue_items where id = v_session.current_item_id and guest_id = p_guest_id);
  if not karaoke.can_control(v_session, p_host_hash, p_guest_id) and not v_skipping_own_song then
    return 'forbidden';
  end if;
  if p_action = 'play' then
    update karaoke.sessions set is_playing = true, last_active_at = now() where id = v_session.id;
  elsif p_action = 'pause' then
    update karaoke.sessions set is_playing = false, last_active_at = now() where id = v_session.id;
  elsif p_action = 'next' then
    if v_session.current_item_id is distinct from p_expected_item_id then
      return 'stale';
    end if;
    perform karaoke.advance(v_session.id);
    update karaoke.sessions set is_playing = true, last_active_at = now() where id = v_session.id;
  else
    return 'invalid';
  end if;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;
