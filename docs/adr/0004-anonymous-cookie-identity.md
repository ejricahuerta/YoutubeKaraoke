# 0004. No accounts: host token and guest id cookies

- Status: Accepted
- Date: 2026-11-21 (recorded; in the code since commit `fa72792`)

## Context
Guests join by scanning a QR code at a party. Any sign-up step would stop most of
them. Still, the app must tell the host from guests, and one guest's songs from
another's.

## Decision
- Starting a session creates a random 32-byte **host token**, stored in an httpOnly
  cookie `kh_<CODE>` for 30 days. The database keeps only its SHA-256 hash.
- Every browser gets a random UUID **guest id** in the httpOnly cookie `kg`.
- Both cookies are `SameSite=Lax` and `Secure` in production. Route handlers read
  them and pass the hash and the id to the database, which decides.
- The singer's name is free text kept in localStorage. It is a label, not an identity.

## Why
- Zero friction: scan, type a name, sing.
- httpOnly keeps the host token away from page scripts, so an injected script
  cannot steal host rights. This is also why the browser cannot call Supabase
  directly (0001).
- Hashing means a leaked table does not hand out host rights.
- A cookie per session lets one browser host several sessions and lets the start
  page offer "resume".

## Consequences
- Host rights live in one browser. Clearing cookies or switching device loses
  them, and there is no way to hand over or recover a session.
- Anyone with the code can add songs under any name. Two people can use the same name.
- A guest who clears cookies can no longer remove their earlier songs.
- Each hosted session adds a cookie to every request until it expires.
- Cookie names date from before the rename to YouOke; changing them would log
  every host out.

## Revisit when
- Hosts ask to move a session to another device, or to have co-hosts.
- Abuse (fake names, queue flooding) becomes a real problem for real sessions.
- A feature needs history across sessions ("my favourites"), which needs accounts.
