-- The main screen may have any number of songs waiting.
--
-- Migration 0006 capped every browser at 3 waiting songs, the main screen included,
-- because it adds under its own guest id. But the main screen is where the room adds
-- songs for people without a phone, so after three it refused every song ("guest_limit").
-- add_item now takes the caller's host token hash, like remove_item does, and the cap
-- applies only when that is not the session's host.
--
-- p_host_hash comes last and defaults to null, so an app still calling with the eight
-- named arguments keeps working (as a guest) while this is rolled out. The old
-- signature is dropped rather than overloaded: two candidates would make those calls
-- ambiguous.

drop function karaoke.add_item(text, text, text, text, text, text, text, integer);

create function karaoke.add_item(
  p_code text, p_guest_id text, p_name text, p_video_id text, p_title text,
  p_channel text, p_thumbnail_url text, p_duration_seconds integer, p_host_hash text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Mirrored in lib/domain/singers.ts (MAX_WAITING_SONGS) for the message guests see.
  c_max_waiting_per_guest constant integer := 3;
  v_session karaoke.sessions;
  v_position double precision;
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
  -- One guest cannot fill the queue. The song being sung does not count, only waiting ones.
  -- The main screen adds for the whole room, so it is not held to this.
  if (p_host_hash is null or v_session.host_token_hash <> p_host_hash)
     and (select count(*) from karaoke.queue_items
            where session_id = v_session.id and status = 'queued' and guest_id = p_guest_id) >= c_max_waiting_per_guest then
    return 'guest_limit';
  end if;
  select coalesce(max(position), 0) + 1 into v_position
    from karaoke.queue_items where session_id = v_session.id;
  insert into karaoke.queue_items
    (session_id, video_id, title, channel, thumbnail_url, duration_seconds, added_by_name, guest_id, position)
  values
    (v_session.id, p_video_id, left(p_title, 300), left(coalesce(p_channel, ''), 200),
     left(coalesce(p_thumbnail_url, ''), 500), greatest(coalesce(p_duration_seconds, 0), 0),
     left(coalesce(nullif(btrim(p_name), ''), 'Guest'), 40), p_guest_id, v_position);
  perform karaoke.ensure_current(v_session.id);
  update karaoke.sessions set last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

-- A new function starts with Postgres' default grant to public; match the other entry points.
revoke execute on function karaoke.add_item(text, text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function karaoke.add_item(text, text, text, text, text, text, text, integer, text) to anon, authenticated, service_role;
