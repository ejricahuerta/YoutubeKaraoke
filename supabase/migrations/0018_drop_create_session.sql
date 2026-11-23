-- Drop create_session.
--
-- Since migration 0017 the app starts sessions with start_session, which only the server's
-- secret key can call and which makes a browser or network wait 15 minutes after a session
-- that ran its full hour (ADR 0025, 0026). create_session stayed only so the app that was
-- live during that deploy kept working (ADR 0015). The publishable key can still call it,
-- with no wait, so it goes now that nothing calls it.

drop function karaoke.create_session(text, text);
