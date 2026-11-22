-- Each guest may have at most 3 songs waiting (issue #21).
--
-- The queue was first come, first served with no limit per person, so one keen guest
-- could add ten songs and everyone else waited an hour. add_item now answers
-- 'guest_limit' when the caller already has 3 songs waiting; the song being sung does
-- not count. "Guest" is the browser's guest id, not the typed name, so renaming yourself
-- does not get you more. Everything else about add_item is unchanged.
--
-- This also applies to songs added from the main screen, which go in under the host
-- browser's own guest id.

create or replace function karaoke.add_item(
  p_code text, p_guest_id text, p_name text, p_video_id text, p_title text,
  p_channel text, p_thumbnail_url text, p_duration_seconds integer
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Mirrored in lib/domain/singers.ts (MAX_WAITING_SONGS) for the message guests see.
  c_max_waiting_per_guest constant integer := 3;
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
  -- One guest cannot fill the queue. The song being sung does not count, only waiting ones.
  if (select count(*) from karaoke.queue_items
        where session_id = v_session_id and status = 'queued' and guest_id = p_guest_id) >= c_max_waiting_per_guest then
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
