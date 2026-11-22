/** Shapes shared by the database functions, the API and every screen. */

/** A song in a session's queue. "Queue item" in code and data, "song" in what people read. */
export type QueueItem = {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  /** The singer's name as typed on their phone. */
  addedBy: string;
  /** Added by the browser asking. */
  mine: boolean;
};

/** Everything a screen needs to draw one session; returned by the get_state database function. */
export type SessionState = {
  code: string;
  /** Closed for good after 15 minutes without activity. */
  archived: boolean;
  isPlaying: boolean;
  /** The browser asking is the one that started the session. */
  isHost: boolean;
  current: QueueItem | null;
  queue: QueueItem[];
  /** Finished songs, newest first, at most 50. Empty for an archived session. */
  played: QueueItem[];
};

export type SearchResult = Pick<QueueItem, "videoId" | "title" | "channel" | "thumbnailUrl" | "durationSeconds">;

export type SearchKind = "karaoke" | "lyrics";

export type PlaybackAction = "play" | "pause" | "next";

/** What a database function that changes a session answers with. */
export type MutationResult = "ok" | "stale" | MutationError;
export type MutationError = "not_found" | "forbidden" | "invalid" | "queue_full" | "archived";

/** Every error code the API can put in `{ ok: false, error }`. */
export type ApiError = MutationError | "rate_limited" | "search_unavailable" | "server_error";
