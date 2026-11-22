-- Let the host end a session on purpose.
--
-- Until now a session could only end by going quiet for 15 minutes. end_session archives
-- it at once: every screen sees "this session has ended" and every other function refuses
-- changes, exactly as for a session that timed out. It is deleted 24 hours later the same way.

create function karaoke.end_session(p_code text, p_host_hash text) returns text
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
  update karaoke.sessions
    set archived_at = now(), current_item_id = null, is_playing = false
    where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;

revoke execute on function karaoke.end_session(text, text) from public, anon, authenticated;
grant execute on function karaoke.end_session(text, text) to anon, authenticated, service_role;
