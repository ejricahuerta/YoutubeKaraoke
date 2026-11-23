/**
 * The only door to the database. Each function calls one Postgres function in the
 * karaoke schema (supabase/migrations); the rules live there, not here.
 */
import { randomInt } from "node:crypto";
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from "@/lib/domain/session-code";
import type { MutationResult, PlaybackAction, SearchResult, SessionState } from "@/lib/domain/types";
import { getSupabaseSecretClient, getSupabaseServerClient } from "./supabase";

const CREATE_ATTEMPTS = 5;

async function rpc<T>(fn: string, args: Record<string, unknown>, client = getSupabaseServerClient()): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
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

/** A new session's code, or how long this browser must wait after its last session ran its full hour. */
export type StartedSession = { code: string } | { waitSeconds: number };

type StartAnswer = { result: "ok" | "taken" | "invalid" } | { result: "wait"; waitSeconds: number };

/**
 * Creates a session with a fresh code for the browser with `guestId` on the network `networkHash`
 * (auth.ts hashNetwork); retries on the rare code collision. Only this call uses the secret key.
 */
export async function createSession(hostTokenHash: string, guestId: string, networkHash: string): Promise<StartedSession> {
  const client = getSupabaseSecretClient();
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateSessionCode();
    const args = { p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId, p_network: networkHash };
    const answer = await rpc<StartAnswer>("start_session", args, client);
    if (answer.result === "ok") return { code };
    if (answer.result === "wait") return { waitSeconds: answer.waitSeconds };
    if (answer.result !== "taken") throw new Error(`start_session answered ${answer.result}`);
  }
  throw new Error("Could not allocate a session code");
}

/** The session as this caller may see it, or null when no session has the code. */
export function getSessionState(code: string, hostTokenHash: string | null, guestId: string | null) {
  return rpc<SessionState | null>("get_state", { p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId });
}

/** YouTube ids of songs finished in the last day, in any session, newest first. */
export async function getRecentlyPlayedVideoIds(): Promise<string[]> {
  return (await rpc<string[] | null>("recently_played", {})) ?? [];
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

/** The main screen or the remote: the database checks which the caller is. */
export function moveQueueItem(code: string, hostTokenHash: string | null, guestId: string, itemId: string, afterId: string | null) {
  return rpc<MutationResult>("move_item", { p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId, p_item_id: itemId, p_after_id: afterId });
}

/** The main screen or the remote: ends `expectedItemId` and plays `itemId`, a waiting song, now. */
export function playQueueItem(code: string, hostTokenHash: string | null, guestId: string, itemId: string, expectedItemId: string | null) {
  return rpc<MutationResult>("play_item", {
    p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId, p_item_id: itemId, p_expected_item_id: expectedItemId,
  });
}

/** The main screen or the remote: the database checks which the caller is. */
export function updatePlayback(code: string, hostTokenHash: string | null, guestId: string, action: PlaybackAction, expectedItemId: string | null) {
  return rpc<MutationResult>("playback", {
    p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId, p_action: action, p_expected_item_id: expectedItemId,
  });
}

/** Host only: whether singers take turns once 3 or more people have songs on the list. */
export function setTakeTurns(code: string, hostTokenHash: string | null, on: boolean) {
  return rpc<MutationResult>("set_take_turns", { p_code: code, p_host_hash: hostTokenHash, p_on: on });
}

/** A phone takes the remote, if it has been freed: the first to ask gets it. */
export function claimRemote(code: string, guestId: string) {
  return rpc<MutationResult>("claim_remote", { p_code: code, p_guest_id: guestId });
}

/** The main screen or the remote itself: frees the remote for another phone to take. */
export function freeRemote(code: string, hostTokenHash: string | null, guestId: string) {
  return rpc<MutationResult>("free_remote", { p_code: code, p_host_hash: hostTokenHash, p_guest_id: guestId });
}

/** The remote, while the main screen is away: stores the hash of a one-time link to move it. */
export function startHandoff(code: string, guestId: string, linkHash: string) {
  return rpc<MutationResult>("start_handoff", { p_code: code, p_guest_id: guestId, p_link_hash: linkHash });
}

/** The device that opened the link becomes the main screen. */
export function takeOver(code: string, linkHash: string, newHostTokenHash: string) {
  return rpc<MutationResult>("take_over", { p_code: code, p_link_hash: linkHash, p_new_host_hash: newHostTokenHash });
}

/** Host only: closes the session for good, at once. */
export function endSession(code: string, hostTokenHash: string | null) {
  return rpc<MutationResult>("end_session", { p_code: code, p_host_hash: hostTokenHash });
}
