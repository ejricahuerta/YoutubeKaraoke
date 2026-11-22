/** Questions about the queue that every screen answers the same way. */
import type { QueueItem, SearchResult } from "./types";

/** Used when YouTube gave no duration for a video. */
const DEFAULT_SONG_SECONDS = 210;

type Timed = { durationSeconds: number };

function songSeconds(item: Timed): number {
  return item.durationSeconds > 0 ? item.durationSeconds : DEFAULT_SONG_SECONDS;
}

/**
 * Seconds until queue[index] starts. Pass queue.length for the whole queue.
 * `elapsed` is how far into the current song we are; when unknown, assume halfway.
 */
export function waitSeconds(current: Timed | null, queue: Timed[], index: number, elapsed?: number): number {
  let total = 0;
  if (current) {
    const length = songSeconds(current);
    total += elapsed === undefined ? length / 2 : Math.max(0, length - elapsed);
  }
  for (let i = 0; i < Math.min(index, queue.length); i++) total += songSeconds(queue[i]);
  return total;
}

/**
 * Where a dragged row lands when dropped on the row at `targetIndex` (it takes that
 * row's place). Returns the id it should follow, null for the top of the queue, or
 * undefined when nothing should move.
 */
export function dropAfterId(queue: { id: string }[], draggedId: string | null, targetIndex: number): string | null | undefined {
  const from = queue.findIndex((item) => item.id === draggedId);
  if (from < 0 || from === targetIndex) return undefined;
  const afterIndex = from < targetIndex ? targetIndex : targetIndex - 1;
  return afterIndex >= 0 ? queue[afterIndex].id : null;
}

export type QueuedSong = { item: QueueItem; index: number };

/** One guest's songs: the one being sung now, and the queued ones with their place in line. */
export function guestLineup(current: QueueItem | null, queue: QueueItem[]) {
  const queued: QueuedSong[] = queue.map((item, index) => ({ item, index })).filter(({ item }) => item.mine);
  const onNow = current?.mine ? current : null;
  return { onNow, queued, next: queued[0] as QueuedSong | undefined, songCount: queued.length + (onNow ? 1 : 0) };
}

/**
 * Names the turn a guest should be told about: "next:<id>" when their song is first in
 * line, "now:<id>" when it starts, null otherwise. A new value means a new moment to alert.
 */
export function turnAlertKey(lineup: ReturnType<typeof guestLineup>): string | null {
  if (lineup.onNow) return `now:${lineup.onNow.id}`;
  return lineup.next?.index === 0 ? `next:${lineup.next.item.id}` : null;
}

export type SessionPlace = { place: "singing" | "queued" | "sung"; by: string; mine: boolean };

/** Where a video already is in the session, if anywhere: being sung, waiting, or sung earlier. */
export function whereInSession(videoId: string, current: QueueItem | null, queue: QueueItem[], played: QueueItem[]): SessionPlace | null {
  const found = (place: SessionPlace["place"], item: QueueItem | undefined) => (item ? { place, by: item.addedBy, mine: item.mine } : null);
  return (
    found("singing", current?.videoId === videoId ? current : undefined) ??
    found("queued", queue.find((item) => item.videoId === videoId)) ??
    found("sung", played.find((item) => item.videoId === videoId))
  );
}

/** The video behind a queue item, as adding it again needs it. */
export function songOf({ videoId, title, channel, thumbnailUrl, durationSeconds }: QueueItem): SearchResult {
  return { videoId, title, channel, thumbnailUrl, durationSeconds };
}
