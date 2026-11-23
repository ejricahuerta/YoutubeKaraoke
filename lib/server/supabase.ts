import { createClient } from "@supabase/supabase-js";

/** Postgres schema that holds the karaoke tables and functions. */
const DB_SCHEMA = "karaoke";

function create(key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let client: ReturnType<typeof create> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** The server's Supabase client, with the publishable key: see docs/adr/0002. */
export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  client ??= create();
  return client;
}

let secretClient: ReturnType<typeof create> | null = null;

/**
 * The server's client with the secret key, for start_session only: the one database function
 * the publishable key cannot call, so nobody can skip the wait after an hour-long session by
 * calling the database directly (ADR 0026). Every other call uses getSupabaseServerClient.
 */
export function getSupabaseSecretClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!isSupabaseConfigured() || !key) {
    throw new Error("SUPABASE_SECRET_KEY is not set: only the server, with that key, can start sessions.");
  }
  secretClient ??= create(key);
  return secretClient;
}
