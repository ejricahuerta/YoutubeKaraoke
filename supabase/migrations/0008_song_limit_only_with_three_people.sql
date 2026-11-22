-- Apply the 3-waiting-songs cap only when at least 3 people have songs on the list.
--
-- With 1 or 2 people at the party there is nobody for one keen singer to keep waiting,
-- so the cap from migration 0006 just got in the way. "People" are distinct guest ids
-- with a song waiting or being sung; someone whose songs have all been sung is not on
-- the list any more. Everything else about add_item is unchanged.
--
-- This only loosens the rule, so it is safe to apply before or after deploying.

create or replace function karaoke.add_item(
  p_code text, p_guest_id text, p_name text, p_video_id text, p_title text,
  p_channel text, p_thumbnail_url text, p_duration_seconds integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Both mirrored in lib/domain/singers.ts for what guests see.
  c_max_waiting_per_guest constant integer := 3;  -- MAX_WAITING_SONGS
  c_people_before_limit constant integer := 3;    -- PEOPLE_BEFORE_SONG_LIMIT
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
  -- One guest cannot fill the queue, once there are enough people for it to matter: the
  -- cap applies only when at least 3 different guests have a song waiting or being sung.
  -- The caller's own song on stage does not count towards their 3, only waiting ones.
  if (select count(*) from karaoke.queue_items
        where session_id = v_session_id and status = 'queued' and guest_id = p_guest_id) >= c_max_waiting_per_guest
     and (select count(distinct guest_id) from karaoke.queue_items
          where session_id = v_session_id and status in ('queued', 'playing')) >= c_people_before_limit then
    return 'guest_limit';
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

-- create or replace keeps add_item's existing grants.
