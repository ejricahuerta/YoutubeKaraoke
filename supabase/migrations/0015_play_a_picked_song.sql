-- The main screen (or the phone remote) picks any waiting song to play now, instead of
-- the next one. The song being sung ends and counts as sung, as with "next", and the
-- picked song starts at once. The rest of the queue keeps its order.
--
-- Like "next", it names the song it interrupts (p_expected_item_id), so a repeated or
-- late request cannot end a second song: it answers 'stale' once something else plays.
-- The app asks the host to confirm before it calls this; the database does not.

create function karaoke.play_item(
  p_code text, p_host_hash text, p_item_id uuid, p_expected_item_id uuid, p_guest_id text default null
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
  if not karaoke.can_control(v_session, p_host_hash, p_guest_id) then
    return 'forbidden';
  end if;
  -- As for play, pause and next: a phone cannot play with no main screen to play on (0014).
  if (p_host_hash is null or v_session.host_token_hash <> p_host_hash) and karaoke.main_screen_away(v_session) then
    return 'main_screen_away';
  end if;
  if v_session.current_item_id is distinct from p_expected_item_id then
    return 'stale';
  end if;
  -- First in the queue, then on: advance starts whatever is first.
  if not karaoke.place_item(v_session.id, p_item_id, null) then
    return 'not_found';
  end if;
  perform karaoke.advance(v_session.id);
  update karaoke.sessions set is_playing = true, last_active_at = now() where id = v_session.id;
  perform karaoke.notify(p_code);
  return 'ok';
end $$;
revoke execute on function karaoke.play_item(text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function karaoke.play_item(text, text, uuid, uuid, text) to anon, authenticated, service_role;
