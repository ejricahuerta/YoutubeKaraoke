-- A session lasts an hour at most.
--
-- Before: a session ended only when the main screen ended it, 15 minutes after the main
-- screen was last seen, or after 30 idle minutes (migration 0014). A busy session with
-- the main screen open could go on all night.
--
-- Now: closes_at() also ends every session an hour after it started (max_length()),
-- whatever is playing or queued, so check_archived, cleanup and the phones' countdown
-- all follow it. get_state reports limitInSeconds, the time left of that hour, so the
-- screens can say why the session is about to end. Sessions already over an hour old
-- end the next time anyone touches them, or at the next cleanup.

-- Internal: the longest a session lasts, counted from when it started.
create function karaoke.max_length() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '1 hour'
$$;

-- Internal: when the session ends if nothing changes: 15 minutes (idle_limit) after the
-- main screen was last seen; with nothing playing and nothing queued, 30 minutes
-- (idle_after) after the last activity; and in any case an hour (max_length) after it
-- started. Whichever is soonest.
create or replace function karaoke.closes_at(p_session karaoke.sessions) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select least(
    p_session.host_seen_at + karaoke.idle_limit(),
    p_session.created_at + karaoke.max_length(),
    case when p_session.current_item_id is null and not exists (
      select 1 from karaoke.queue_items q where q.session_id = p_session.id and q.status = 'queued'
    ) then p_session.last_active_at + karaoke.idle_after() end
  )
$$;

revoke execute on function karaoke.max_length(), karaoke.closes_at(karaoke.sessions)
  from public, anon, authenticated;

-- As in migration 0014, plus limitInSeconds.
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
      'hostAwaySeconds', null, 'closesInSeconds', null, 'limitInSeconds', null, 'isRemote', false,
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
    -- Time left of the session's hour (migration 0016), so the screens can say why it is ending.
    'limitInSeconds', greatest(0, floor(extract(epoch from v_session.created_at + karaoke.max_length() - now())))::int,
    -- No heartbeat for a while: nothing is playing, and phones are told (migration 0014).
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

