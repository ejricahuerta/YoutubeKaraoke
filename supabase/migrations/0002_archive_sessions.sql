-- Archive sessions after 15 minutes of inactivity; delete them 24 hours later.
--
-- "Activity" is the main screen being open (its state poll is a heartbeat),
-- or anyone adding a song or using a control. An archived session is over for
-- good: every entry point reports it as archived and refuses changes.
-- Archiving is checked on access, so it is exact without a scheduler.

alter table karaoke.sessions add column archived_at timestamptz;
create index sessions_archived_idx on karaoke.sessions (archived_at);

-- Internal: true if the session is archived, archiving it first if it has gone stale.
create function karaoke.check_archived(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
begin
  select * into v_session from karaoke.sessions where id = p_session_id for update;
  if v_session.archived_at is not null then
    return true;
  end if;
  if v_session.last_active_at >= now() - interval '15 minutes' then
    return false;
  end if;
  update karaoke.sessions
    set archived_at = now(), current_item_id = null, is_playing = false
    where id = p_session_id;
  perform karaoke.notify(v_session.code);
  return true;
end $$;

-- Internal: archive every stale session and delete those archived over a day ago
-- (their queue items go with them).
create function karaoke.cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update karaoke.sessions
    set archived_at = now(), current_item_id = null, is_playing = false
    where archived_at is null and last_active_at < now() - interval '15 minutes';
  delete from karaoke.sessions where archived_at < now() - interval '24 hours';
end $$;

revoke execute on function karaoke.check_archived(uuid), karaoke.cleanup()
  from public, anon, authenticated;

create or replace function karaoke.create_session(p_code text, p_host_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform karaoke.cleanup();
  insert into karaoke.sessions (code, host_token_hash) values (p_code, p_host_hash);
  return true;
exception when unique_violation then
  return false;
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
      'current', null, 'queue', '[]'::jsonb);
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
    ), '[]'::jsonb)
  );
end $$;

create or replace function karaoke.add_item(
  p_code text, p_guest_id text, p_name text, p_video_id text, p_title text,
  p_channel text, p_thumbnail_url text, p_duration_seconds integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session_id uuid;
  v_position double precision;
begin
  select id into v_session_id from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session_id) then
    return 'archived';
  end if;
  if p_video_id !~ '^[A-Za-z0-9_-]{11}$' or coalesce(p_guest_id, '') = '' then
    return 'invalid';
  end if;
  if (select count(*) from karaoke.queue_items
        where session_id = v_session_id and status = 'queued') >= 200 then
    return 'queue_full';
  end if;
  select coalesce(max(position), 0) + 1 into v_position
    from karaoke.queue_items where session_id = v_session_id;
  insert into karaoke.queue_items
    (session_id, video_id, title, channel, thumbnail_url, duration_seconds, added_by_name, guest_id, position)
  values
    (v_session_id, p_video_id, left(p_title, 300), left(coalesce(p_channel, ''), 200),
     left(coalesce(p_thumbnail_url, ''), 500), greatest(coalesce(p_duration_seconds, 0), 0),
     left(coalesce(nullif(btrim(p_name), ''), 'Guest'), 40), p_guest_id, v_position);
  perform karaoke.ensure_current(v_session_id);
  update karaoke.sessions set last_active_at = now() where id = v_session_id;
  perform karaoke.notify(p_code);
  return 'ok';
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
  v_is_host := p_host_hash is not null and v_session.host_token_hash = p_host_hash;
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

create or replace function karaoke.move_item(
  p_code text, p_host_hash text, p_item_id uuid, p_after_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
  v_prev double precision;
  v_next double precision;
begin
  select * into v_session from karaoke.sessions where code = p_code for update;
  if not found then
    return 'not_found';
  end if;
  if karaoke.check_archived(v_session.id) then
    return 'archived';
  end if;
  if p_host_hash is null or v_session.host_token_hash <> p_host_hash then
    return 'forbidden';
  end if;
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

create or replace function karaoke.playback(
  p_code text, p_host_hash text, p_action text, p_expected_item_id uuid
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
  if p_host_hash is null or v_session.host_token_hash <> p_host_hash then
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

-- Run the cleanup every 5 minutes when pg_cron is already enabled in this
-- project. Without it, stale sessions are still archived on access and old ones
-- are deleted whenever a new session is created.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('karaoke-cleanup', '*/5 * * * *', 'select karaoke.cleanup()');
  end if;
end $$;
