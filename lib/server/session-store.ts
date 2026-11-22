/**
 * The only door to the database. Each function calls one Postgres function in the
 * karaoke schema (supabase/migrations); the rules live there, not here.
 */
import { randomInt } from "node:crypto";
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from "@/lib/domain/session-code";
import type { MutationResult, PlaybackAction, SearchResult, SessionState } from "@/lib/domain/types";
import { getSupabaseServerClient } from "./supabase";

const CREATE_ATTEMPTS = 5;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseServerClient().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[randomInt(SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

/** Creates a session with a fresh code; retries on the rare code collision. */
export async function createSession(hostTokenHash: string): Promise<string> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateSessionCode();
    if (await rpc<boolean>("create_session", { p_code: code, p_host_hash: hostTokenHash })) return code;
  }
  throw new Error("Could not allocate a session code");
}

/** The session as this caller may see it, or null when no session has the code. */
export function getSessionState(code: string, hostTokenHash: string | null, guestId: string | null) {
  return rpc<SessionState | null>("get_state", { p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId });
}

/** The host's token lifts the limit on waiting songs: the main screen adds for everyone. */
export function addQueueItem(code: string, hostTokenHash: string | null, guestId: string, name: string, video: SearchResult) {
  return rpc<MutationResult>("add_item", {
    p_code: code,
    p_host_hash: hostTokenHash,
    p_guest_id: guestId,
    p_name: name,
    p_video_id: video.videoId,
    p_title: video.title,
    p_channel: video.channel,
    p_thumbnail_url: video.thumbnailUrl,
    p_duration_seconds: video.durationSeconds,
  });
}

export function removeQueueItem(code: string, itemId: string, hostTokenHash: string | null, guestId: string) {
  return rpc<MutationResult>("remove_item", { p_code: code, p_item_id: itemId, p_host_hash: hostTokenHash, p_guest_id: guestId });
}

export function moveQueueItem(code: string, hostTokenHash: string | null, itemId: string, afterId: string | null) {
  return rpc<MutationResult>("move_item", { p_code: code, p_host_hash: hostTokenHash, p_item_id: itemId, p_after_id: afterId });
}

export function updatePlayback(code: string, hostTokenHash: string | null, action: PlaybackAction, expectedItemId: string | null) {
  return rpc<MutationResult>("playback", { p_code: code, p_host_hash: hostTokenHash, p_action: action, p_expected_item_id: expectedItemId });
}

/** Host only: closes the session for good, at once. */
export function endSession(code: string, hostTokenHash: string | null) {
  return rpc<MutationResult>("end_session", { p_code: code, p_host_hash: hostTokenHash });
}
