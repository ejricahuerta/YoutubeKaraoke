-- Hand the remote over (issue #48).
--
-- The first phone to join a session is its remote (migration 0010), and nothing could
-- change that: if a guest scanned the code before the host's phone, they kept the remote
-- all night, and a remote whose phone lost its cookies left the session without one.
--
-- Now everyone sees who has the remote (get_state's remote and remoteName). The main
-- screen, or the remote itself, can free it (free_remote): sessions.remote_guest_id
-- becomes '' (free), which joining does not claim, unlike null (unclaimed, no phone has
-- joined yet). Then the first phone to ask takes it (claim_remote). Guest ids are never
-- shown, so a phone cannot be named or picked from a list; whoever should have the
-- remote asks for it on their own phone.

-- Internal: what get_state reports about the remote, from sessions.remote_guest_id.
create function karaoke.remote_status(p_remote_guest_id text) returns text
language sql immutable security definer set search_path = '' as $$
  select case when p_remote_guest_id is null then 'unclaimed' when p_remote_guest_id = '' then 'free' else 'taken' end
$$;
revoke execute on function karaoke.remote_status(text) from public, anon, authenticated;

-- The main screen, or the remote itself, frees the remote for someone else to take.
create function karaoke.free_remote(p_code text, p_host_hash text, p_guest_id text) returns text
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
  update karaoke.sessions set remote_guest_id = '', last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;
revoke execute on function karaoke.free_remote(text, text, text) from public, anon, authenticated;
grant execute on function karaoke.free_remote(text, text, text) to anon, authenticated, service_role;

-- A phone takes a freed remote; the first to ask gets it.
create function karaoke.claim_remote(p_code text, p_guest_id text) returns text
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
  if coalesce(p_guest_id, '') = '' then
    return 'invalid';
  end if;
  if v_session.remote_guest_id is distinct from '' then
    return 'forbidden';
  end if;
  update karaoke.sessions set remote_guest_id = p_guest_id, last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;
revoke execute on function karaoke.claim_remote(text, text) from public, anon, authenticated;
grant execute on function karaoke.claim_remote(text, text) to anon, authenticated, service_role;

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
      'remoteName', null);
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
