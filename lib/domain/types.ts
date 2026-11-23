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

export type RemoteStatus = "unclaimed" | "taken" | "free";

/** Everything a screen needs to draw one session; returned by the get_state database function. */
export type SessionState = {
  code: string;
  /** Closed for good: ended by the main screen, by inactivity, or an hour after it started. */
  archived: boolean;
  isPlaying: boolean;
  /** The browser asking is the one that started the session. */
  isHost: boolean;
  /** The browser asking was the first guest to join, so it may control playback and the queue (migration 0010). */
  isRemote: boolean;
  /**
   * Who has the remote (migration 0012): "unclaimed" until a phone joins and takes it,
   * "taken", or "free" after the main screen or the remote let it go, until a phone asks for it.
   */
  remote: RemoteStatus;
  /** The remote's singer name, once it has added a song. */
  remoteName: string | null;
  /**
   * No heartbeat from the main screen for 150 seconds (migration 0014): nothing is playing,
   * phones cannot play, and the session ends 15 minutes after it was last seen.
   */
  mainScreenAway: boolean;
  /** Once 3 or more people have songs on the list, each sings once per round; the main screen can switch it off (migration 0011). */
  takeTurns: boolean;
  current: QueueItem | null;
  queue: QueueItem[];
  /** Finished songs, newest first, at most 50. Empty for an archived session. */
  played: QueueItem[];
  /** Seconds since the main screen last polled; null when archived or not reported. */
  hostAwaySeconds: number | null;
  /** Seconds until the session closes if nothing happens; null when archived or not reported. */
  closesInSeconds: number | null;
  /** Seconds left of the hour a session lasts at most (migration 0016); null when archived or not reported. */
  limitInSeconds: number | null;
};

export type SearchResult = Pick<QueueItem, "videoId" | "title" | "channel" | "thumbnailUrl" | "durationSeconds">;

/** A song sung lately in any session, for the start page. Titles come from YouTube, not from whoever added the song. */
export type RecentSong = Pick<QueueItem, "videoId" | "title">;

export type SearchKind = "karaoke" | "lyrics";

export type PlaybackAction = "play" | "pause" | "next";

/** What a database function that changes a session answers with. */
export type MutationResult = "ok" | "stale" | MutationError;
export type MutationError =
  | "not_found"
  | "forbidden"
  | "invalid"
  | "queue_full"
  | "guest_limit"
  | "archived"
  /** A phone tried to play, pause or skip with no main screen to play on (migration 0014). */
  | "main_screen_away"
  /** The main screen cannot be moved while it is there. */
  | "main_screen_here";

/** Every error code the API can put in `{ ok: false, error }`. */
export type ApiError = MutationError | "rate_limited" | "search_unavailable" | "server_error" | "too_soon";
