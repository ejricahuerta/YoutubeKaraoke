/** Every call a screen makes to the app's API. Nothing here throws: failures come back as codes. */
import type { ApiError, MutationResult, PlaybackAction, SearchKind, SearchResult } from "@/lib/domain/types";

/** What a change to a session came to: the database's answer, or why there was none. */
export type MutationOutcome = MutationResult | ApiError | "network_error";
export type SearchOutcome = { results: SearchResult[] } | { error: ApiError | "network_error" };

export function sessionStateUrl(code: string): string {
  return `/api/sessions/${code}`;
}

async function mutate(path: string, method: string, body?: unknown): Promise<MutationOutcome> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return "network_error";
  }
  const data = await res.json().catch(() => null);
  return (res.ok ? data?.result : data?.error) ?? "server_error";
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
