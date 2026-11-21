import { afterEach, describe, expect, it, vi } from "vitest";
import { thumbnailUrl } from "@/lib/domain/video";
import { isEmbeddable, mapVideoNode } from "@/lib/server/youtube-search";

describe("mapVideoNode", () => {
  const node = {
    type: "Video",
    video_id: "dQw4w9WgXcQ",
    title: { text: " Never Gonna Give You Up (Karaoke) " },
    author: { name: "Sing King" },
    duration: { seconds: 213 },
  };

  it("maps a normal video", () => {
    expect(mapVideoNode(node)).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up (Karaoke)",
      channel: "Sing King",
      thumbnailUrl: thumbnailUrl("dQw4w9WgXcQ"),
      durationSeconds: 213,
    });
  });

  it("drops non-videos, live streams, and malformed entries", () => {
    expect(mapVideoNode({ ...node, type: "Channel" })).toBeNull();
    expect(mapVideoNode({ ...node, is_live: true })).toBeNull();
    expect(mapVideoNode({ ...node, is_upcoming: true })).toBeNull();
    expect(mapVideoNode({ ...node, duration: { seconds: 0 } })).toBeNull();
    expect(mapVideoNode({ ...node, video_id: "bad id" })).toBeNull();
    expect(mapVideoNode({ ...node, title: { text: "" } })).toBeNull();
    expect(mapVideoNode(null)).toBeNull();
  });
});

describe("isEmbeddable", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respondWith = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));

  it("is true when YouTube's oEmbed endpoint answers for the video", async () => {
    respondWith(200);
    expect(await isEmbeddable("embedOk0001")).toBe(true);
  });

  it("is false when the owner turned embedding off or the video is gone", async () => {
    respondWith(401);
    expect(await isEmbeddable("embedNo0401")).toBe(false);
    respondWith(403);
    expect(await isEmbeddable("embedNo0403")).toBe(false);
    respondWith(404);
    expect(await isEmbeddable("embedNo0404")).toBe(false);
  });

  it("assumes yes when the check itself fails, and asks again next time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await isEmbeddable("embedErr001")).toBe(true);
    respondWith(403);
    expect(await isEmbeddable("embedErr001")).toBe(false);
  });

  it("remembers an answer instead of asking YouTube twice", async () => {
    respondWith(200);
    await isEmbeddable("embedMemo01");
    await isEmbeddable("embedMemo01");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
