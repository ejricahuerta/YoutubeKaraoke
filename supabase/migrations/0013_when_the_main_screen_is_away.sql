-- When the main screen is away (asked for after #48).
--
-- Before: the session ended 15 minutes after the last activity, and guests adding songs
-- counted, so a session could linger with no main screen and nothing playing; phones
-- still said "Playing"; the remote's buttons did nothing visible; if the main screen's
-- browser could not come back, nobody could ever be the main screen again; and an open
-- main screen kept a session alive forever.
--
-- Now:
-- - The main screen's poll is its heartbeat (host_seen_at) and nothing else; it no longer
--   counts as activity (last_active_at).
-- - After 150 seconds without it, the main screen is away: get_state says so
--   (mainScreenAway), playback is paused, and phones cannot play, pause or skip
--   (main_screen_away). Guests can still add songs for when it is back.
-- - A session ends 15 minutes after the main screen was last seen, whatever guests do,
--   or after 30 minutes with nothing playing and nothing queued, even with the main
--   screen open. closes_at() is the one place that decides, for check_archived, cleanup
--   and the countdown phones show.
-- - While it is away, the remote can create a one-time link (start_handoff, valid 10
--   minutes, only its hash stored). The device that opens it becomes the main screen
--   (take_over), and the old one stops being host. If the main screen came back in the
--   meantime, the link is refused.

alter table karaoke.sessions add column handoff_hash text, add column handoff_expires_at timestamptz;

-- Internal: after how long without a heartbeat the main screen counts as away. Its poll is
-- every 15 seconds but written once a minute, so a gap of up to about 75 seconds is normal.
create function karaoke.away_after() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '150 seconds'
$$;

-- Internal: how long a session with nothing playing and nothing queued lives.
create function karaoke.idle_after() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '30 minutes'
$$;

create function karaoke.main_screen_away(p_session karaoke.sessions) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_session.host_seen_at < now() - karaoke.away_after()
$$;

-- Internal: when the session ends if nothing changes: 15 minutes (idle_limit) after the
-- main screen was last seen, or, with nothing playing and nothing queued, 30 minutes
-- (idle_after) after the last activity, whichever is sooner.
create function karaoke.closes_at(p_session karaoke.sessions) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select least(
    p_session.host_seen_at + karaoke.idle_limit(),
    case when p_session.current_item_id is null and not exists (
      select 1 from karaoke.queue_items q where q.session_id = p_session.id and q.status = 'queued'
    ) then p_session.last_active_at + karaoke.idle_after() end
  )
$$;

revoke execute on function karaoke.away_after(), karaoke.idle_after(), karaoke.main_screen_away(karaoke.sessions),
  karaoke.closes_at(karaoke.sessions) from public, anon, authenticated;

create or replace function karaoke.check_archived(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
begin
  select * into v_session from karaoke.sessions where id = p_session_id for update;
  if v_session.archived_at is not null then
    return true;
  end if;
  if now() < karaoke.closes_at(v_session) then
    return false;
  end if;
  update karaoke.sessions
    set archived_at = now(), current_item_id = null, is_playing = false
    where id = p_session_id;
  perform karaoke.notify(v_session.code);
  return true;
end $$;

create or replace function karaoke.cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update karaoke.sessions s
    set archived_at = now(), current_item_id = null, is_playing = false
    where s.archived_at is null and karaoke.closes_at(s) <= now();
  delete from karaoke.sessions where archived_at < now() - interval '24 hours';
end $$;

-- The remote, while the main screen is away, asks for a one-time link to move it to another
-- device. p_link_hash is the hash of the link's secret; the secret itself is never stored.
create function karaoke.start_handoff(p_code text, p_guest_id text, p_link_hash text) returns text
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
  if coalesce(p_guest_id, '') = '' or v_session.remote_guest_id is distinct from p_guest_id or coalesce(p_link_hash, '') = '' then
    return 'forbidden';
  end if;
  if not karaoke.main_screen_away(v_session) then
    return 'main_screen_here';
  end if;
  update karaoke.sessions set handoff_hash = p_link_hash, handoff_expires_at = now() + interval '10 minutes'
    where id = v_session.id;
  return 'ok';
end $$;

-- The device that opens the link becomes the main screen; the old one stops being host.
create function karaoke.take_over(p_code text, p_link_hash text, p_new_host_hash text) returns text
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
  if v_session.handoff_hash is null or v_session.handoff_hash is distinct from p_link_hash
     or v_session.handoff_expires_at <= now() or coalesce(p_new_host_hash, '') = '' then
    return 'forbidden';
  end if;
  if not karaoke.main_screen_away(v_session) then
    return 'main_screen_here';
  end if;
  update karaoke.sessions
    set host_token_hash = p_new_host_hash, host_seen_at = now(), handoff_hash = null, handoff_expires_at = null
    where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

revoke execute on function karaoke.start_handoff(text, text, text), karaoke.take_over(text, text, text)
  from public, anon, authenticated;
grant execute on function karaoke.start_handoff(text, text, text), karaoke.take_over(text, text, text)
  to anon, authenticated, service_role;

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
  -- A phone cannot play, pause or skip with no main screen to play on (migration 0013).
  if (p_host_hash is null or v_session.host_token_hash <> p_host_hash) and karaoke.main_screen_away(v_session) then
    return 'main_screen_away';
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
      'hostAwaySeconds', null, 'closesInSeconds', null, 'isRemote', false,
      'takeTurns', v_session.take_turns, 'remote', karaoke.remote_status(v_session.remote_guest_id),
      'remoteName', null, 'mainScreenAway', false);
  end if;
  -- Heartbeat: an open main screen polls this and counts as seen, written at most once a
  -- minute. It is not activity: an open screen with nothing to play still goes idle.
  if v_is_host and v_session.host_seen_at < now() - interval '1 minute' then
    update karaoke.sessions set host_seen_at = now() where id = v_session.id returning * into v_session;
  end if;
  -- With the main screen away nothing can play, so say so, and leave it paused for its return.
  if karaoke.main_screen_away(v_session) and v_session.is_playing then
    update karaoke.sessions set is_playing = false where id = v_session.id returning * into v_session;
    perform karaoke.notify(p_code);
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
    'takeTurns', v_session.take_turns,
    'isRemote', not v_is_host and coalesce(p_guest_id, '') <> '' and v_session.remote_guest_id = p_guest_id,
    -- Who has the remote, for everyone: 'unclaimed' (the first phone to join takes it),
    -- 'taken', or 'free' (freed: the first phone to ask takes it). The name is the remote's
    -- latest singer name, once it has added a song; its guest id is never shown.
    'remote', karaoke.remote_status(v_session.remote_guest_id),
    'remoteName', (
      select i.added_by_name from karaoke.queue_items i
      where i.session_id = v_session.id and i.guest_id = v_session.remote_guest_id
      order by i.created_at desc limit 1
    ),
    -- How long since the main screen last polled, and how long until the session closes
    -- if nothing happens. Guests use these to warn that the main screen has gone.
    'hostAwaySeconds', floor(extract(epoch from now() - v_session.host_seen_at))::int,
    'closesInSeconds', greatest(0, floor(extract(epoch from karaoke.closes_at(v_session) - now())))::int,
    -- No heartbeat for a while: nothing is playing, and phones are told (migration 0013).
    'mainScreenAway', karaoke.main_screen_away(v_session),
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
