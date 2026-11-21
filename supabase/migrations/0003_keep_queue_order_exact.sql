-- Keep the queue in a strict order however often it is reordered.
--
-- move_item places a song halfway between its new neighbours' positions. Every move into
-- the same gap halves that gap, and after about fifty a double precision number cannot
-- tell the midpoint from a neighbour: two songs share a position and their order is
-- undefined. When a gap gets that small, this version first renumbers the session's
-- waiting songs 1, 2, 3, ... (the order does not change), then places the song.
--
-- Only move_item changes. Nothing else about the schema or its permissions does.

create or replace function karaoke.move_item(
  p_code text, p_host_hash text, p_item_id uuid, p_after_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  -- Far above where a double near 200 loses precision, so there is always room to halve again.
  c_min_gap constant double precision := 1e-6;
  v_session karaoke.sessions;
  v_prev double precision;
  v_next double precision;
  v_attempt integer;
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

  -- At most two passes: the second only after renumbering, when every gap is 1.
  for v_attempt in 1..2 loop
    v_prev := null;
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

    exit when v_prev is null or v_next is null or v_next - v_prev >= c_min_gap;

    update karaoke.queue_items q set position = r.place
      from (
        select id, row_number() over (order by position, created_at, id) as place
        from karaoke.queue_items
        where session_id = v_session.id and status = 'queued'
      ) r
      where q.id = r.id;
  end loop;

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
