-- After a session reaches its hour, the browser and the network that started it can start
-- the next one 15 minutes later (ADR 0025, 0026).
--
-- Each session now records the guest id of the browser that started it (started_by) and a
-- keyed hash of its network (started_from; the server makes it, the address itself is never
-- stored). The new start_session refuses ('wait', with waitSeconds) while a session started by
-- that browser or from that network reached its hour less than 15 minutes ago
-- (restart_after()). A session that ended before its hour, by the main screen or for being
-- idle, means no wait.
--
-- Only the server can call start_session, with its secret key (service_role): with the
-- publishable key anyone could call it with a made-up guest id and network and skip the wait.
-- create_session stays for the app that is live while this deploys; a later migration
-- drops it once the app calls start_session, which closes that way round the wait too.

alter table karaoke.sessions add column started_by text, add column started_from text;
create index sessions_started_by_idx on karaoke.sessions (started_by);
create index sessions_started_from_idx on karaoke.sessions (started_from);

-- Internal: how long after its session's hour a browser or network waits to start another.
create function karaoke.restart_after() returns interval
language sql immutable security definer set search_path = '' as $$
  select interval '15 minutes'
$$;

revoke execute on function karaoke.restart_after() from public, anon, authenticated;

-- Starts a session for the browser with guest id p_guest_id on the network p_network.
-- Answers {"result": "ok"}, {"result": "taken"} when the code is in use, {"result": "invalid"}
-- without a guest id or network, or {"result": "wait", "waitSeconds": n} after an hour-long
-- session started by the same browser or from the same network.
create function karaoke.start_session(p_code text, p_host_hash text, p_guest_id text, p_network text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_free_at timestamptz;
begin
  if coalesce(p_guest_id, '') = '' or coalesce(p_network, '') = '' then
    return jsonb_build_object('result', 'invalid');
  end if;
  -- Ends every session past its time first, so an hour-long one is archived by now.
  perform karaoke.cleanup();
  -- A session ran its full hour when it was archived no earlier than the hour's end.
  select max(s.created_at + karaoke.max_length() + karaoke.restart_after()) into v_free_at
    from karaoke.sessions s
    where (s.started_by = p_guest_id or s.started_from = p_network)
      and s.archived_at >= s.created_at + karaoke.max_length();
  if v_free_at > now() then
    return jsonb_build_object('result', 'wait', 'waitSeconds', ceil(extract(epoch from v_free_at - now()))::int);
  end if;
  insert into karaoke.sessions (code, host_token_hash, started_by, started_from)
    values (p_code, p_host_hash, p_guest_id, p_network);
  return jsonb_build_object('result', 'ok');
exception when unique_violation then
  return jsonb_build_object('result', 'taken');
end $$;

revoke execute on function karaoke.start_session(text, text, text, text) from public, anon, authenticated;
grant execute on function karaoke.start_session(text, text, text, text) to service_role;
