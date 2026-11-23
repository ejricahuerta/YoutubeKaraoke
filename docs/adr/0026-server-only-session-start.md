# 0026. Signed guest cookie, a wait per network, and only the server starts sessions

- Status: Accepted
- Date: 2026-11-23
- Amends: 0002 (the server holds no secret key), 0004 (anonymous cookie identity), 0025 (the 15-minute wait)

## Context
0025 made a browser wait 15 minutes after its session ran its full hour, keyed on the guest
id in the `kg` cookie. That was easy to get round three ways: edit the cookie, delete it (or
open a private window), or skip the app and call `start_session` directly with the
publishable key, which is public by design (0002). The owner asked that people cannot get
round it by tampering with cookies, and chose to close all three.

## Decision
- **Signed guest cookie.** `kg` holds `<guest id>.<HMAC-SHA256 of it>`, keyed with
  `SESSION_SECRET` (server-only, 32+ characters). A cookie that is edited, forged, signed
  with another secret, or from before this change is ignored and replaced by a new id, as if
  there were none. The host cookie needs no signature: only its hash is stored, so any
  other value matches nothing (0004).
- **The wait also applies per network.** The server hashes the address of the request that
  starts a session (`x-forwarded-for` as Vercel sets it) with the same secret, the whole
  address for IPv4 and the /64 for IPv6 (`lib/domain/network.ts`), and stores only the hash,
  `sessions.started_from`. `start_session` makes a browser wait if its guest id **or** its
  network started a session that ran its full hour less than 15 minutes ago.
- **Only the server starts sessions.** `start_session` can be called by `service_role`
  only, so the server holds a Supabase secret key, `SUPABASE_SECRET_KEY`, and uses it for
  that one call (`getSupabaseSecretClient`). Every other call still uses the publishable key,
  and every rule still lives in the database.
- A Vercel production build stops before migrating if either secret is missing.
- `create_session`, callable with the publishable key, stays only until this app is live
  (migrations must work with the app that is live, 0015). A follow-up migration drops it.

## Why
- Signing is the standard way to make a cookie tamper-evident; nothing in the browser can
  stop it being deleted, so a second key the browser does not hold (its network) is needed.
- Hashing with a secret, not plain SHA-256, matters for addresses: there are few enough IPv4
  addresses to hash them all and look one up.
- A secret key used for one function keeps 0002's reasoning for everything else, and the
  production environment already holds a stronger credential (`DATABASE_URL`) at build time.
- Alternatives that lost: an IP-only wait (no way to tell a venue's screens apart when
  their addresses do differ); a shared secret checked inside the function (it would have to
  travel in every call and be set in the database by hand).

## Consequences
- Two more secrets to set, for Production and Preview. Losing `SESSION_SECRET` logs every
  guest out of their songs and remote; losing the secret key means nobody can start a
  session. Rotating `SESSION_SECRET` does the same as losing it.
- On the first deploy, every guest gets a new id: guests in a session at that moment lose
  "my songs" and the remote, which the main screen can free (0020).
- Screens on one network share the wait: a second screen in the same home or venue, or
  people behind the same carrier-grade NAT, wait 15 minutes after someone else's hour-long
  session there.
- Still possible: a different network (phone hotspot, VPN), or ending the session from the
  main screen just before the hour.
- The network hash is personal data: the Privacy Policy says it is kept, why, and that it is
  deleted with its session.

## Revisit when
- People report being made to wait by someone else's session on a shared network: key the
  wait on the browser alone again, or shorten it.
- The secret key is needed for more than starting sessions: reconsider 0002 as a whole.
