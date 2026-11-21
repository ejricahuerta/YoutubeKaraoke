export type QueueItem = {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  addedBy: string;
  mine: boolean;
};

export type SessionState = {
  code: string;
  /** Closed for good after 15 minutes without activity. */
  archived: boolean;
  isPlaying: boolean;
  isHost: boolean;
  current: QueueItem | null;
  queue: QueueItem[];
};

export type SearchResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSeconds: number;
};

export type SearchKind = "karaoke" | "lyrics";
