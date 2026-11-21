import { generateCode } from "./codes";
import { supabaseServer } from "./supabase-server";
import type { SessionState } from "./types";

export type MutationResult = "ok" | "not_found" | "forbidden" | "invalid" | "queue_full" | "stale" | "archived";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseServer().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

/** Creates a session with a fresh code; retries on the rare code collision. */
export async function createSession(hostHash: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await rpc<boolean>("create_session", { p_code: code, p_host_hash: hostHash })) return code;
  }
  throw new Error("Could not allocate a session code");
}

export function getState(code: string, hostHash: string | null, guestId: string | null) {
  return rpc<SessionState | null>("get_state", {
    p_code: code,
    p_host_hash: hostHash,
    p_guest_id: guestId,
  });
}

export function addItem(
  code: string,
  guestId: string,
  name: string,
  video: { videoId: string; title: string; channel: string; thumbnailUrl: string; durationSeconds: number },
) {
  return rpc<MutationResult>("add_item", {
    p_code: code,
    p_guest_id: guestId,
    p_name: name,
    p_video_id: video.videoId,
    p_title: video.title,
    p_channel: video.channel,
    p_thumbnail_url: video.thumbnailUrl,
    p_duration_seconds: video.durationSeconds,
  });
}

export function removeItem(code: string, itemId: string, hostHash: string | null, guestId: string) {
  return rpc<MutationResult>("remove_item", {
    p_code: code,
    p_item_id: itemId,
    p_host_hash: hostHash,
    p_guest_id: guestId,
  });
}

export function moveItem(code: string, hostHash: string | null, itemId: string, afterId: string | null) {
  return rpc<MutationResult>("move_item", {
    p_code: code,
    p_host_hash: hostHash,
    p_item_id: itemId,
    p_after_id: afterId,
  });
}

export function playback(code: string, hostHash: string | null, action: string, expectedItemId: string | null) {
  return rpc<MutationResult>("playback", {
    p_code: code,
    p_host_hash: hostHash,
    p_action: action,
    p_expected_item_id: expectedItemId,
  });
}
