import { afterEach, describe, expect, it, vi } from "vitest";
import { thumbnailUrl } from "@/lib/domain/video";
import { mapDataApiVideo, parseIsoDuration, searchWithDataApi } from "@/lib/server/youtube-data-api";

describe("parseIsoDuration", () => {
  it("reads YouTube's ISO 8601 lengths", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT3M")).toBe(180);
  });

  it("is 0 for live streams and anything it cannot read", () => {
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration("4:13")).toBe(0);
  });
});

describe("mapDataApiVideo", () => {
  const item = {
    id: "dQw4w9WgXcQ",
    snippet: { title: " Never Gonna Give You Up (Karaoke) ", channelTitle: "Sing King", liveBroadcastContent: "none" },
    contentDetails: { duration: "PT3M33S" },
    status: { embeddable: true },
  };

  it("maps a normal video to the same shape keyless search gives", () => {
    expect(mapDataApiVideo(item)).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up (Karaoke)",
      channel: "Sing King",
      thumbnailUrl: thumbnailUrl("dQw4w9WgXcQ"),
      durationSeconds: 213,
    });
  });

  it("drops live and upcoming streams, videos that cannot be embedded, and malformed entries", () => {
    expect(mapDataApiVideo({ ...item, snippet: { ...item.snippet, liveBroadcastContent: "live" } })).toBeNull();
    expect(mapDataApiVideo({ ...item, snippet: { ...item.snippet, liveBroadcastContent: "upcoming" } })).toBeNull();
    expect(mapDataApiVideo({ ...item, status: { embeddable: false } })).toBeNull();
    expect(mapDataApiVideo({ ...item, contentDetails: { duration: "P0D" } })).toBeNull();
    expect(mapDataApiVideo({ ...item, id: "bad id" })).toBeNull();
    expect(mapDataApiVideo({ ...item, snippet: { ...item.snippet, title: "" } })).toBeNull();
    expect(mapDataApiVideo(null)).toBeNull();
  });
});

describe("searchWithDataApi", () => {
  afterEach(() => vi.unstubAllGlobals());
  const video = (id: string, title: string) => ({
    id, snippet: { title, channelTitle: "c", liveBroadcastContent: "none" }, contentDetails: { duration: "PT3M" }, status: { embeddable: true },
  });

  it("searches for embeddable videos, then looks up their lengths, keeping YouTube's order", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/search")) return Response.json({ items: [{ id: { videoId: "bbbbbbbbbbb" } }, { id: { videoId: "aaaaaaaaaaa" } }] });
      return Response.json({ items: [video("aaaaaaaaaaa", "A"), video("bbbbbbbbbbb", "B")] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchWithDataApi("hello karaoke", "test-key");
    expect(results.map((r) => r.title)).toEqual(["B", "A"]);

    const search = new URL(fetchMock.mock.calls[0][0]);
    expect(search.origin + search.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(Object.fromEntries(search.searchParams)).toMatchObject({
      q: "hello karaoke", type: "video", videoEmbeddable: "true", part: "id", maxResults: "20", key: "test-key",
    });
    const details = new URL(fetchMock.mock.calls[1][0]);
    expect(details.pathname).toBe("/youtube/v3/videos");
    expect(details.searchParams.get("id")).toBe("bbbbbbbbbbb,aaaaaaaaaaa");
  });

  it("makes no second call when nothing was found", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchWithDataApi("nothing", "k")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when YouTube refuses, for example over quota, without putting the key in the error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "quotaExceeded" } }, { status: 403 })));
    const error = await searchWithDataApi("hello", "secret-key").catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain("403");
    expect(String(error)).not.toContain("secret-key");
  });
});
