/** Turns untrusted JSON bodies into the values the session store accepts, or null when they are not valid. */
import { normalizeSingerName } from "@/lib/domain/singers";
import type { PlaybackAction, SearchResult } from "@/lib/domain/types";
import { isVideoId, thumbnailUrl } from "@/lib/domain/video";

type Body = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseAddSongRequest(body: Body): { name: string; video: SearchResult } | null {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!isVideoId(body.videoId) || !title) return null;
  const seconds = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) ? body.durationSeconds : 0;
  return {
    name: normalizeSingerName(body.name),
    video: {
      videoId: body.videoId,
      title,
      channel: typeof body.channel === "string" ? body.channel : "",
      thumbnailUrl: thumbnailUrl(body.videoId), // never trust a client-supplied image URL
      durationSeconds: Math.max(0, Math.floor(seconds)),
    },
  };
}

const PLAYBACK_ACTIONS: readonly unknown[] = ["play", "pause", "next"] satisfies PlaybackAction[];

export function parsePlaybackRequest(body: Body): { action: PlaybackAction; expectedItemId: string | null } | null {
  if (!PLAYBACK_ACTIONS.includes(body.action)) return null;
  return { action: body.action as PlaybackAction, expectedItemId: isUuid(body.expectedItemId) ? body.expectedItemId : null };
}

/**
 * `expectedItemId` is the song the caller believes is being sung, which playing a picked song
 * ends. Missing or malformed reads as nothing playing; the database answers stale if that is wrong.
 */
export function parsePlayNowRequest(body: Body): { expectedItemId: string | null } {
  return { expectedItemId: isUuid(body.expectedItemId) ? body.expectedItemId : null };
}

/** `afterId` is the queue item to move after; null or missing means the top of the queue. */
export function parseMoveRequest(body: Body): { afterId: string | null } | null {
  const afterId = body.afterId ?? null;
  if (afterId !== null && !isUuid(afterId)) return null;
  return { afterId };
}

/** The secret from a "move the main screen" link: base64url, as createHostToken makes it. */
export function parseTakeOverRequest(body: Body): { token: string } | null {
  return typeof body.token === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(body.token) ? { token: body.token } : null;
}

/** The main screen's settings for a session: for now, whether singers take turns. */
export function parseSettingsRequest(body: Body): { takeTurns: boolean } | null {
  return typeof body.takeTurns === "boolean" ? { takeTurns: body.takeTurns } : null;
}
