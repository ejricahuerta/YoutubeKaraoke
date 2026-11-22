-- The first guest to join a session is its remote (issue #22).
--
-- The host often sits across the room from the main screen. Whoever opens the session on
-- a phone first can now play, pause, skip, remove and reorder from that phone, like the
-- main screen. Nothing to set up: get_state records the first guest id it sees (never
-- the main screen's own browser) in sessions.remote_guest_id, and reports isRemote.
-- Ending the session stays with the main screen. Separately, whoever added the song
-- being sung may skip it, and do nothing else.
--
-- playback and move_item get a new signature with p_guest_id last, next to the old
-- ones, so nothing is dropped and the app now deployed keeps working (host only) until
-- the new one is. A later migration can drop the old signatures. remove_item already
-- took the guest id, so it is replaced in place.

alter table karaoke.sessions add column remote_guest_id text;

-- Internal: whether the caller may control playback and the queue: the main screen, or the remote.
create function karaoke.can_control(p_session karaoke.sessions, p_host_hash text, p_guest_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p_host_hash is not null and p_session.host_token_hash = p_host_hash)
      or (coalesce(p_guest_id, '') <> '' and p_session.remote_guest_id = p_guest_id)
$$;
revoke execute on function karaoke.can_control(karaoke.sessions, text, text) from public, anon, authenticated;

create or replace function karaoke.get_state(p_code text, p_host_hash text, p_guest_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
  v_is_host boolean;
  v_archived boolean;
begin
  select * into v_session from karaoke.sessions where code = p_code;
  if not found then
    return null;
  end if;
  v_is_host := p_host_hash is not null and v_session.host_token_hash = p_host_hash;
  v_archived := karaoke.check_archived(v_session.id);
  if v_archived then
    return jsonb_build_object(
      'code', v_session.code, 'archived', true, 'isPlaying', false, 'isHost', v_is_host,
      'current', null, 'queue', '[]'::jsonb, 'played', '[]'::jsonb,
      'hostAwaySeconds', null, 'closesInSeconds', null, 'isRemote', false);
  end if;
  -- Heartbeat: an open main screen polls this, keeps its session alive and counts as seen.
  -- Written at most once a minute; host_seen_at is checked too, because guests adding
  -- songs keep last_active_at fresh while the main screen is closed.
  if v_is_host and (v_session.last_active_at < now() - interval '1 minute'
                    or v_session.host_seen_at < now() - interval '1 minute') then
    update karaoke.sessions set last_active_at = now(), host_seen_at = now() where id = v_session.id
      returning * into v_session;
  end if;
  -- The first guest to join becomes the remote. The main screen's own browser never does,
  -- and a call without a guest id (the search route) is not joining.
  if not v_is_host and coalesce(p_guest_id, '') <> '' and v_session.remote_guest_id is null then
    update karaoke.sessions set remote_guest_id = p_guest_id
      where id = v_session.id and remote_guest_id is null;
    select remote_guest_id into v_session.remote_guest_id from karaoke.sessions where id = v_session.id;
  end if;
  return jsonb_build_object(
    'code', v_session.code,
    'archived', false,
    'isPlaying', v_session.is_playing,
    'isHost', v_is_host,
    'isRemote', not v_is_host and v_session.remote_guest_id is not distinct from p_guest_id and p_guest_id is not null,
    -- How long since the main screen last polled, and how long until the session closes
    -- if nothing happens. Guests use these to warn that the main screen has gone.
    'hostAwaySeconds', floor(extract(epoch from now() - v_session.host_seen_at))::int,
    'closesInSeconds', greatest(0, floor(extract(epoch from v_session.last_active_at + karaoke.idle_limit() - now())))::int,
    'current', (
      select jsonb_build_object(
        'id', i.id, 'videoId', i.video_id, 'title', i.title, 'channel', i.channel,
        'thumbnailUrl', i.thumbnail_url, 'durationSeconds', i.duration_seconds,
        'addedBy', i.added_by_name, 'mine', i.guest_id = p_guest_id)
      from karaoke.queue_items i where i.id = v_session.current_item_id
    ),
    'queue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'videoId', i.video_id, 'title', i.title, 'channel', i.channel,
        'thumbnailUrl', i.thumbnail_url, 'durationSeconds', i.duration_seconds,
        'addedBy', i.added_by_name, 'mine', i.guest_id = p_guest_id) order by i.position)
      from karaoke.queue_items i
      where i.session_id = v_session.id and i.status = 'queued'
    ), '[]'::jsonb),
    -- Finished songs, newest first. Capped so the state stays small on a long night.
    'played', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'videoId', p.video_id, 'title', p.title, 'channel', p.channel,
        'thumbnailUrl', p.thumbnail_url, 'durationSeconds', p.duration_seconds,
        'addedBy', p.added_by_name, 'mine', p.guest_id = p_guest_id) order by p.played_at desc nulls last, p.position desc)
      from (
        select * from karaoke.queue_items
        where session_id = v_session.id and status = 'played'
        order by played_at desc nulls last, position desc
        limit 50
      ) p
    ), '[]'::jsonb)
  );
end $$;

create or replace function karaoke.remove_item(
  p_code text, p_item_id uuid, p_host_hash text, p_guest_id text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
  v_item karaoke.queue_items;
  v_is_host boolean;
begin
  select * into v_session from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session.id) then
    return 'archived';
  end if;
  select * into v_item from karaoke.queue_items
    where id = p_item_id and session_id = v_session.id and status <> 'played';
  if not found then
    return 'not_found';
  end if;
  v_is_host := karaoke.can_control(v_session, p_host_hash, p_guest_id);
  if not v_is_host and not (v_item.guest_id = p_guest_id and v_item.status = 'queued') then
    return 'forbidden';
  end if;
  if v_item.status = 'playing' then
    perform karaoke.advance(v_session.id);
  end if;
  delete from karaoke.queue_items where id = v_item.id;
  update karaoke.sessions set last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

create function karaoke.playback(
  p_code text, p_host_hash text, p_action text, p_expected_item_id uuid, p_guest_id text
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

create function karaoke.move_item(
  p_code text, p_host_hash text, p_item_id uuid, p_after_id uuid, p_guest_id text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Far above where a double near 200 loses precision, so there is always room to halve again.
  c_min_gap constant double precision := 1e-6;
  v_session karaoke.sessions;
  v_prev double precision;
  v_next double precision;
  v_attempt integer;
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

  -- At most two passes: the second only after renumbering, when every gap is 1.
  for v_attempt in 1..2 loop
    v_prev := null;
    if p_after_id is not null then
      select position into v_prev from karaoke.queue_items
        where id = p_after_id and session_id = v_session.id and status = 'queued';
      if not found then
        return 'not_found';
      end if;
    end if;
    select min(position) into v_next from karaoke.queue_items
      where session_id = v_session.id and status = 'queued' and id <> p_item_id
        and (v_prev is null or position > v_prev);

    exit when v_prev is null or v_next is null or v_next - v_prev >= c_min_gap;

    update karaoke.queue_items q set position = r.place
      from (
        select id, row_number() over (order by position, created_at, id) as place
        from karaoke.queue_items
        where session_id = v_session.id and status = 'queued'
      ) r
      where q.id = r.id;
  end loop;

  update karaoke.queue_items
    set position = case
      when v_prev is null and v_next is null then position
      when v_prev is null then v_next - 1
      when v_next is null then v_prev + 1
      else (v_prev + v_next) / 2 end
    where id = p_item_id and session_id = v_session.id and status = 'queued';
  if not found then
    return 'not_found';
  end if;
  update karaoke.sessions set last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

-- New functions start with Postgres' default grant to public; match the other entry points.
revoke execute on function karaoke.playback(text, text, text, uuid, text), karaoke.move_item(text, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function karaoke.playback(text, text, text, uuid, text), karaoke.move_item(text, text, uuid, uuid, text)
  to anon, authenticated, service_role;
