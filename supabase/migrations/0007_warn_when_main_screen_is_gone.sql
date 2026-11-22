-- Warn guests when the main screen has gone, and write the 15-minute window once.
--
-- A session closes 15 minutes after its last activity, and guests adding songs count as
-- activity. So guests can keep a session alive while nothing plays, and then lose it
-- without warning once they stop. get_state now also reports how long ago the main
-- screen last polled (hostAwaySeconds, from a new host_seen_at column) and how long until
-- the session closes (closesInSeconds), so the guest screen can say so.
--
-- The window itself was written in two functions; idle_limit() is now the one place.
-- check_archived and cleanup behave exactly as before.
--
-- Old app versions ignore the new fields. Existing sessions start with host_seen_at = now.

alter table karaoke.sessions add column host_seen_at timestamptz not null default now();

-- Internal: how long a session lives without activity.
create function karaoke.idle_limit() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '15 minutes'
$$;
revoke execute on function karaoke.idle_limit() from public, anon, authenticated;

create or replace function karaoke.check_archived(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
begin
  select * into v_session from karaoke.sessions where id = p_session_id for update;
  if v_session.archived_at is not null then
    return true;
  end if;
  if v_session.last_active_at >= now() - karaoke.idle_limit() then
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
  update karaoke.sessions
    set archived_at = now(), current_item_id = null, is_playing = false
    where archived_at is null and last_active_at < now() - karaoke.idle_limit();
  delete from karaoke.sessions where archived_at < now() - interval '24 hours';
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
      'hostAwaySeconds', null, 'closesInSeconds', null);
  end if;
  -- Heartbeat: an open main screen polls this, keeps its session alive and counts as seen.
  -- Written at most once a minute; host_seen_at is checked too, because guests adding
  -- songs keep last_active_at fresh while the main screen is closed.
  if v_is_host and (v_session.last_active_at < now() - interval '1 minute'
                    or v_session.host_seen_at < now() - interval '1 minute') then
    update karaoke.sessions set last_active_at = now(), host_seen_at = now() where id = v_session.id
      returning * into v_session;
  end if;
  return jsonb_build_object(
    'code', v_session.code,
    'archived', false,
    'isPlaying', v_session.is_playing,
    'isHost', v_is_host,
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

-- create or replace keeps each replaced function's existing grants.
