-- After a session reaches its hour, the browser that started it can start the next one
-- 15 minutes later.
--
-- Each session now records the guest id of the browser that started it (started_by). The
-- new start_session refuses ('wait', with waitSeconds) while one of that browser's
-- sessions reached its hour less than 15 minutes ago (restart_after()). A session that
-- ended before its hour, by the main screen or for being idle, means no wait.
--
-- create_session stays for the app that is live while this deploys; a later migration
-- drops it once the app calls start_session.

alter table karaoke.sessions add column started_by text;
create index sessions_started_by_idx on karaoke.sessions (started_by);

-- Internal: how long after its session's hour a browser waits to start another.
create function karaoke.restart_after() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '15 minutes'
$$;

revoke execute on function karaoke.restart_after() from public, anon, authenticated;

-- Starts a session for the browser with guest id p_guest_id. Answers {"result": "ok"},
-- {"result": "taken"} when the code is in use, {"result": "invalid"} without a guest id,
-- or {"result": "wait", "waitSeconds": n} after an hour-long session of the same browser.
create function karaoke.start_session(p_code text, p_host_hash text, p_guest_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_free_at timestamptz;
begin
  if coalesce(p_guest_id, '') = '' then
    return jsonb_build_object('result', 'invalid');
  end if;
  -- Ends every session past its time first, so an hour-long one is archived by now.
  perform karaoke.cleanup();
  -- A session ran its full hour when it was archived no earlier than the hour's end.
  select max(s.created_at + karaoke.max_length() + karaoke.restart_after()) into v_free_at
    from karaoke.sessions s
    where s.started_by = p_guest_id
      and s.archived_at >= s.created_at + karaoke.max_length();
  if v_free_at > now() then
    return jsonb_build_object('result', 'wait', 'waitSeconds', ceil(extract(epoch from v_free_at - now()))::int);
  end if;
  insert into karaoke.sessions (code, host_token_hash, started_by) values (p_code, p_host_hash, p_guest_id);
  return jsonb_build_object('result', 'ok');
exception when unique_violation then
  return jsonb_build_object('result', 'taken');
end $$;

grant execute on function karaoke.start_session(text, text, text) to anon, authenticated, service_role;
