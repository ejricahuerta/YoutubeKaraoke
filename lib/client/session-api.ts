/** Every call a screen makes to the app's API. Nothing here throws: failures come back as codes. */
import type { ApiError, MutationResult, PlaybackAction, RecentSong, SearchKind, SearchResult } from "@/lib/domain/types";

/** What a change to a session came to: the database's answer, or why there was none. */
export type MutationOutcome = MutationResult | ApiError | "network_error";
export type SearchOutcome = { results: SearchResult[] } | { error: ApiError | "network_error" };

export function sessionStateUrl(code: string): string {
  return `/api/sessions/${code}`;
}

/** A change sent to the API: its outcome, and the rest of the answer for the few that carry more. */
async function send(path: string, method: string, body?: unknown): Promise<{ outcome: MutationOutcome; data: Record<string, unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { outcome: "network_error", data: null };
  }
  const data = await res.json().catch(() => null);
  return { outcome: (res.ok ? data?.result : data?.error) ?? "server_error", data };
}

async function mutate(path: string, method: string, body?: unknown): Promise<MutationOutcome> {
  return (await send(path, method, body)).outcome;
}

export function addSong(code: string, video: SearchResult, singerName: string) {
  return mutate(`${sessionStateUrl(code)}/queue`, "POST", { ...video, name: singerName });
}

export function removeSong(code: string, itemId: string) {
  return mutate(`${sessionStateUrl(code)}/queue/${itemId}`, "DELETE");
}

/** Host only: moves a song to just after `afterId` (null = top of the queue). */
export function moveSong(code: string, itemId: string, afterId: string | null) {
  return mutate(`${sessionStateUrl(code)}/queue/${itemId}`, "PATCH", { afterId });
}

/** Host only. For "next", pass the item the host believes is playing so a repeat cannot skip two songs. */
export function sendPlayback(code: string, action: PlaybackAction, expectedItemId?: string) {
  return mutate(`${sessionStateUrl(code)}/playback`, "POST", { action, expectedItemId });
}

/** Host only: whether singers take turns once 3 or more people have songs on the list. */
export function setTakeTurns(code: string, on: boolean) {
  return mutate(sessionStateUrl(code), "PATCH", { takeTurns: on });
}

/** Takes the remote for this phone, if it is free. */
export function claimRemote(code: string) {
  return mutate(`${sessionStateUrl(code)}/remote`, "POST");
}

/** The main screen or the remote itself: lets the remote go, for another phone to take. */
export function freeRemote(code: string) {
  return mutate(`${sessionStateUrl(code)}/remote`, "DELETE");
}

/**
 * The remote, while the main screen is away: a one-time secret for a link that moves the
 * main screen to another device. Null with the reason when the server refuses.
 */
export async function startHandoff(code: string): Promise<{ outcome: MutationOutcome; token: string | null }> {
  const { outcome, data } = await send(`${sessionStateUrl(code)}/handoff`, "POST");
  return { outcome, token: outcome === "ok" && typeof data?.token === "string" ? data.token : null };
}

/** The address of the page that, opened on a big screen, makes it the main screen. */
export function takeOverUrl(origin: string, code: string, token: string): string {
  return `${origin}/s/${code}?takeover=${encodeURIComponent(token)}`;
}

/** Opening that link: makes this browser the main screen. */
export function takeOver(code: string, token: string) {
  return mutate(`${sessionStateUrl(code)}/host`, "POST", { token });
}

/** Host only: closes the session for everyone. It cannot be reopened. */
export function endSession(code: string) {
  return mutate(sessionStateUrl(code), "DELETE");
}

export async function searchSongs(code: string, query: string, kind: SearchKind): Promise<SearchOutcome> {
  try {
    const res = await fetch(`/api/search?${new URLSearchParams({ code, kind, q: query })}`);
    const data = await res.json().catch(() => null);
    return res.ok ? { results: data?.results ?? [] } : { error: data?.error ?? "server_error" };
  } catch {
    return { error: "network_error" };
  }
}

/** Songs sung lately in any session, for the start page; none when they cannot be fetched. */
export async function fetchRecentSongs(): Promise<RecentSong[]> {
  try {
    const res = await fetch("/api/recent-songs");
    const data = res.ok ? await res.json().catch(() => null) : null;
    return Array.isArray(data?.songs) ? data.songs : [];
  } catch {
    return [];
  }
}
