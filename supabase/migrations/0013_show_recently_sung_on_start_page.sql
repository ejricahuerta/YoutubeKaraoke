-- Show songs sung recently, in any session, on the start page (docs/adr/0021).
--
-- recently_played() answers the YouTube video ids of songs finished in the last day,
-- newest first, each video once, at most 24. Only the ids: never who sang them, in which
-- session, or the title a browser sent with the song. The app asks YouTube for each
-- video's title itself, so nobody can put their own words on the start page.
--
-- A day is as long as finished songs are kept anyway: cleanup deletes a session and its
-- songs 24 hours after it closes.
--
-- Only adds a function and an index, so it works with the app that is live now.

create index queue_items_played_at on karaoke.queue_items (played_at desc) where status = 'played';

create function karaoke.recently_played() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(video_id order by last_played_at desc), '{}')
  from (
    select video_id, max(played_at) as last_played_at
    from karaoke.queue_items
    where status = 'played' and played_at > now() - interval '1 day'
    group by video_id
    order by last_played_at desc
    limit 24
  ) recent
$$;

-- A new function starts with Postgres' default grant to public; match the other entry points.
revoke execute on function karaoke.recently_played() from public, anon, authenticated;
grant execute on function karaoke.recently_played() to anon, authenticated, service_role;
