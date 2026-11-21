-- YouTube Karaoke schema.
-- Everything lives in its own "karaoke" schema. Tables are locked down with RLS
-- and no policies: every read and write goes through the SECURITY DEFINER
-- functions below, which check the host token hash or guest id themselves.
--
-- After applying, add "karaoke" to the project's exposed API schemas
-- (Supabase dashboard > Project Settings > API > Exposed schemas).

create schema karaoke;
grant usage on schema karaoke to anon, authenticated, service_role;

create table karaoke.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_token_hash text not null,
  current_item_id uuid,
  is_playing boolean not null default true,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table karaoke.queue_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references karaoke.sessions (id) on delete cascade,
  video_id text not null,
  title text not null,
  channel text not null default '',
  thumbnail_url text not null default '',
  duration_seconds integer not null default 0,
  added_by_name text not null default 'Guest',
  guest_id text not null,
  position double precision not null,
  status text not null default 'queued' check (status in ('queued', 'playing', 'played')),
  created_at timestamptz not null default now()
);

create index queue_items_session_idx
  on karaoke.queue_items (session_id, status, position);

alter table karaoke.sessions enable row level security;
alter table karaoke.queue_items enable row level security;

-- Internal: tell subscribers of the session's public Realtime channel to refetch.
create function karaoke.notify(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'changed', 'session:' || p_code, false);
exception when others then
  null; -- Realtime is best effort; clients also poll.
end $$;

-- Internal: if nothing is playing, promote the first queued item.
create function karaoke.ensure_current(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_next uuid;
begin
  if (select current_item_id from karaoke.sessions where id = p_session_id) is not null then
    return;
  end if;
  select id into v_next from karaoke.queue_items
    where session_id = p_session_id and status = 'queued'
    order by position limit 1;
  if v_next is null then
    return;
  end if;
  update karaoke.queue_items set status = 'playing' where id = v_next;
  update karaoke.sessions set current_item_id = v_next, is_playing = true where id = p_session_id;
end $$;

-- Internal: finish the current item and move on.
create function karaoke.advance(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update karaoke.queue_items set status = 'played'
    where session_id = p_session_id and status = 'playing';
  update karaoke.sessions set current_item_id = null where id = p_session_id;
  perform karaoke.ensure_current(p_session_id);
end $$;

create function karaoke.create_session(p_code text, p_host_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from karaoke.sessions where last_active_at < now() - interval '24 hours';
  insert into karaoke.sessions (code, host_token_hash) values (p_code, p_host_hash);
  return true;
exception when unique_violation then
  return false;
end $$;

create function karaoke.get_state(p_code text, p_host_hash text, p_guest_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_session karaoke.sessions;
  v_is_host boolean;
begin
  select * into v_session from karaoke.sessions where code = p_code;
  if not found then
    return null;
  end if;
  v_is_host := p_host_hash is not null and v_session.host_token_hash = p_host_hash;
  if v_is_host and v_session.last_active_at < now() - interval '5 minutes' then
    update karaoke.sessions set last_active_at = now() where id = v_session.id;
  end if;
  return jsonb_build_object(
    'code', v_session.code,
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

create function karaoke.add_item(
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

-- Host may remove anything (removing the playing item skips it).
-- Guests may remove only their own, still-queued items.
create function karaoke.remove_item(
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
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

-- Host only: move a queued item to just after p_after_id (null = top of queue).
create function karaoke.move_item(
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
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

-- Host only: play | pause | next. For "next", p_expected_item_id is the item the
-- host believes is playing; if it no longer is, the call is a no-op, so a
-- double-fired "ended" event cannot skip two songs.
create function karaoke.playback(
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

-- Lock down: internal helpers are not callable from the API at all; the public
-- entry points are callable with the anon (publishable) key.
revoke execute on all functions in schema karaoke from public, anon, authenticated;
grant execute on function
  karaoke.create_session(text, text),
  karaoke.get_state(text, text, text),
  karaoke.add_item(text, text, text, text, text, text, text, integer),
  karaoke.remove_item(text, uuid, text, text),
  karaoke.move_item(text, text, uuid, uuid),
  karaoke.playback(text, text, text, uuid)
  to anon, authenticated, service_role;
