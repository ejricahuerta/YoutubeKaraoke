-- Show what has been sung tonight.
--
-- Finished songs were already kept (status 'played') but nothing showed them. get_state
-- now returns them as "played", newest first, at most 50. A new played_at column records
-- when each one finished, because a song's position does not say when it was sung: the
-- host can move songs around after earlier ones have played.
--
-- Old app versions ignore the extra field, so this can be applied before or after deploying.
-- Songs that finished before this migration have no played_at and sort last.

alter table karaoke.queue_items add column played_at timestamptz;

-- Internal: finish the current item and move on. Now also records when it finished.
-- clock_timestamp, not now(): several songs can finish in one transaction and must stay in order.
create or replace function karaoke.advance(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update karaoke.queue_items set status = 'played', played_at = clock_timestamp()
    where session_id = p_session_id and status = 'playing';
  update karaoke.sessions set current_item_id = null where id = p_session_id;
  perform karaoke.ensure_current(p_session_id);
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
      'current', null, 'queue', '[]'::jsonb, 'played', '[]'::jsonb);
  end if;
  -- Heartbeat: an open main screen polls this and keeps its session alive.
  if v_is_host and v_session.last_active_at < now() - interval '1 minute' then
    update karaoke.sessions set last_active_at = now() where id = v_session.id;
  end if;
  return jsonb_build_object(
    'code', v_session.code,
    'archived', false,
    'isPlaying', v_session.is_playing,
    'isHost', v_is_host,
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

-- create or replace keeps each function's existing grants: advance stays internal,
-- get_state stays callable by the API roles.
