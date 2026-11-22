import { describe, expect, it } from "vitest";
import { dropAfterId, guestLineup, songLimitReached, songOf, turnAlertKey, waitSeconds, whereInSession } from "@/lib/domain/queue";
import type { QueueItem } from "@/lib/domain/types";

describe("waitSeconds", () => {
  const queue = [{ durationSeconds: 200 }, { durationSeconds: 0 }, { durationSeconds: 100 }];

  it("is zero when nothing is ahead", () => {
    expect(waitSeconds(null, queue, 0)).toBe(0);
  });

  it("assumes the current song is halfway through when the position is unknown", () => {
    expect(waitSeconds({ durationSeconds: 240 }, queue, 0)).toBe(120);
  });

  it("uses the real position when it is known, and 3.5 minutes for songs with no length", () => {
    expect(waitSeconds({ durationSeconds: 240 }, queue, 2, 200)).toBe(40 + 200 + 210);
  });

  it("never counts a song that has run past its listed length as negative", () => {
    expect(waitSeconds({ durationSeconds: 240 }, queue, 0, 999)).toBe(0);
  });

  it("sums the whole queue for an index past the end", () => {
    expect(waitSeconds(null, queue, 99)).toBe(510);
  });
});

describe("dropAfterId", () => {
  const queue = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("moves a row down to take the target row's place", () => {
    expect(dropAfterId(queue, "a", 2)).toBe("c");
  });

  it("moves a row up to take the target row's place", () => {
    expect(dropAfterId(queue, "d", 1)).toBe("a");
  });

  it("moves a row to the top", () => {
    expect(dropAfterId(queue, "c", 0)).toBeNull();
  });

  it("does nothing when dropped on itself or when the row is unknown", () => {
    expect(dropAfterId(queue, "b", 1)).toBeUndefined();
    expect(dropAfterId(queue, "zz", 1)).toBeUndefined();
    expect(dropAfterId(queue, null, 1)).toBeUndefined();
  });
});

describe("guestLineup", () => {
  const song = (id: string, mine: boolean): QueueItem => ({
    id, videoId: `video-${id}`, title: id, channel: "", thumbnailUrl: "", durationSeconds: 100, addedBy: "x", mine,
  });

  it("finds this guest's songs with their place in the queue", () => {
    const lineup = guestLineup(song("now", false), [song("a", false), song("b", true), song("c", true)]);
    expect(lineup.onNow).toBeNull();
    expect(lineup.queued.map(({ item, index }) => [item.id, index])).toEqual([["b", 1], ["c", 2]]);
    expect(lineup.next?.item.id).toBe("b");
    expect(lineup.songCount).toBe(2);
  });

  it("counts the song being sung now", () => {
    const lineup = guestLineup(song("now", true), [song("a", true)]);
    expect(lineup.onNow?.id).toBe("now");
    expect(lineup.songCount).toBe(2);
  });

  it("is empty for a guest with no songs", () => {
    const lineup = guestLineup(null, [song("a", false)]);
    expect(lineup).toEqual({ onNow: null, queued: [], next: undefined, songCount: 0 });
  });
});

describe("turnAlertKey", () => {
  const song = (id: string, mine: boolean): QueueItem => ({
    id, videoId: `video-${id}`, title: id, channel: "", thumbnailUrl: "", durationSeconds: 100, addedBy: "x", mine,
  });

  it("names the moment a guest's song is first in line", () => {
    expect(turnAlertKey(guestLineup(song("now", false), [song("a", true), song("b", false)]))).toBe("next:a");
  });

  it("names the moment a guest's song starts", () => {
    expect(turnAlertKey(guestLineup(song("a", true), [song("b", true)]))).toBe("now:a");
  });

  it("is null while the guest is further back or has no songs", () => {
    expect(turnAlertKey(guestLineup(song("now", false), [song("a", false), song("b", true)]))).toBeNull();
    expect(turnAlertKey(guestLineup(null, []))).toBeNull();
  });

  it("changes when the same guest's next song comes up, so each turn alerts once", () => {
    const first = turnAlertKey(guestLineup(null, [song("a", true), song("b", true)]));
    const second = turnAlertKey(guestLineup(song("a", true), [song("b", true)]));
    const third = turnAlertKey(guestLineup(song("b", true), []));
    expect(new Set([first, second, third]).size).toBe(3);
  });
});

describe("whereInSession", () => {
  const item = (id: string, videoId: string, addedBy: string, mine = false): QueueItem => ({
    id, videoId, title: id, channel: "", thumbnailUrl: "", durationSeconds: 100, addedBy, mine,
  });
  const current = item("now", "v-now", "Maya");
  const queue = [item("q1", "v-q", "Leo", true), item("q2", "v-dup", "Sam")];
  const played = [item("p1", "v-dup", "Ana"), item("p2", "v-old", "Zoë", true)];

  it("says a video is being sung, waiting, or was sung earlier, and by whom", () => {
    expect(whereInSession("v-now", current, queue, played)).toEqual({ place: "singing", by: "Maya", mine: false });
    expect(whereInSession("v-q", current, queue, played)).toEqual({ place: "queued", by: "Leo", mine: true });
    expect(whereInSession("v-old", current, queue, played)).toEqual({ place: "sung", by: "Zoë", mine: true });
  });

  it("prefers what is happening now over what happened earlier", () => {
    expect(whereInSession("v-dup", current, queue, played)?.place).toBe("queued");
  });

  it("is null for a video the session has not seen", () => {
    expect(whereInSession("v-new", current, queue, played)).toBeNull();
    expect(whereInSession("v-new", null, [], [])).toBeNull();
  });
});

describe("songOf", () => {
  it("keeps only what adding the song again needs", () => {
    const item: QueueItem = { id: "x", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u", durationSeconds: 9, addedBy: "Ana", mine: true };
    expect(songOf(item)).toEqual({ videoId: "v", title: "t", channel: "c", thumbnailUrl: "u", durationSeconds: 9 });
  });
});

describe("songLimitReached", () => {
  const item = (id: string, addedBy: string, mine = false): QueueItem => ({
    id, videoId: `v-${id}`, title: id, channel: "", thumbnailUrl: "", durationSeconds: 100, addedBy, mine,
  });
  const mine = [item("m1", "Leo", true), item("m2", "Leo", true), item("m3", "Leo", true)];

  it("is reached with 3 of your songs waiting and 3 people on the list", () => {
    expect(songLimitReached(item("now", "Maya"), [item("s", "Sam"), ...mine])).toBe(true);
  });

  it("counts the person singing now", () => {
    expect(songLimitReached(item("now", "Maya"), [...mine])).toBe(false);
    expect(songLimitReached(item("now", "Maya"), [item("s", "Sam"), ...mine])).toBe(true);
  });

  it("is not reached with only 1 or 2 people, however many songs you have", () => {
    expect(songLimitReached(null, [...mine, item("m4", "Leo", true)])).toBe(false);
    expect(songLimitReached(item("now", "Maya"), [...mine, item("m4", "Leo", true)])).toBe(false);
  });

  it("is not reached with fewer than 3 of your songs waiting", () => {
    expect(songLimitReached(item("now", "Maya"), [item("s", "Sam"), mine[0], mine[1]])).toBe(false);
  });

  it("counts other people by name, ignoring case and spaces", () => {
    expect(songLimitReached(item("now", "Maya"), [item("a", " maya "), ...mine])).toBe(false);
  });
});
