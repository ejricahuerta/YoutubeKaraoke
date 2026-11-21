import { createClient } from "@supabase/supabase-js";

/** Postgres schema that holds the karaoke tables and functions. */
const DB_SCHEMA = "karaoke";

function create() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let client: ReturnType<typeof create> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** The server's Supabase client. It holds only the publishable key: see docs/adr/0002. */
export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  client ??= create();
  return client;
}
