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
