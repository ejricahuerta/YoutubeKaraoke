import { afterEach, describe, expect, it, vi } from "vitest";
import { addSong, endSession, fetchRecentSongs, moveSong, playSongNow, removeSong, searchSongs, sendPlayback, sessionStateUrl } from "@/lib/client/session-api";

const video = { videoId: "dQw4w9WgXcQ", title: "Song", channel: "Sing King", thumbnailUrl: "u", durationSeconds: 200 };
const ITEM_ID = "3f2c1b7e-8a4d-4e6f-9b0a-1c2d3e4f5a6b";

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn(async (..._args: [string, RequestInit?]) => Response.json(body, { status }));
  vi.stubGlobal("fetch", mock);
  return mock;
}
const sent = (mock: ReturnType<typeof stubFetch>) => {
  const [url, init] = mock.mock.calls[0];
  return { url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

afterEach(() => vi.unstubAllGlobals());

describe("session mutations", () => {
  it("adds a song under the singer's name", async () => {
    const mock = stubFetch(200, { ok: true, result: "ok" });
    expect(await addSong("ABC234", video, "Maya")).toBe("ok");
    expect(sent(mock)).toEqual({ url: "/api/sessions/ABC234/queue", method: "POST", body: { ...video, name: "Maya" } });
  });

  it("removes and moves songs by id", async () => {
    let mock = stubFetch(200, { ok: true, result: "ok" });
    await removeSong("ABC234", ITEM_ID);
    expect(sent(mock)).toEqual({ url: `/api/sessions/ABC234/queue/${ITEM_ID}`, method: "DELETE", body: undefined });

    mock = stubFetch(200, { ok: true, result: "ok" });
    await moveSong("ABC234", ITEM_ID, null);
    expect(sent(mock)).toEqual({ url: `/api/sessions/ABC234/queue/${ITEM_ID}`, method: "PATCH", body: { afterId: null } });
  });

  it("sends playback actions, with the song the host believes is playing", async () => {
    const mock = stubFetch(200, { ok: true, result: "stale" });
    expect(await sendPlayback("ABC234", "next", ITEM_ID)).toBe("stale");
    expect(sent(mock)).toEqual({ url: "/api/sessions/ABC234/playback", method: "POST", body: { action: "next", expectedItemId: ITEM_ID } });
  });

  it("plays a picked song now, naming the song it interrupts", async () => {
    const mock = stubFetch(200, { ok: true, result: "ok" });
    expect(await playSongNow("ABC234", ITEM_ID, "00000000-0000-4000-8000-000000000001")).toBe("ok");
    expect(sent(mock)).toEqual({
      url: `/api/sessions/ABC234/queue/${ITEM_ID}`,
      method: "POST",
      body: { expectedItemId: "00000000-0000-4000-8000-000000000001" },
    });
  });

  it("ends the session", async () => {
    const mock = stubFetch(200, { ok: true, result: "ok" });
    expect(await endSession("ABC234")).toBe("ok");
    expect(sent(mock)).toEqual({ url: "/api/sessions/ABC234", method: "DELETE", body: undefined });
  });

  it("reports the server's error code", async () => {
    stubFetch(409, { ok: false, error: "queue_full" });
    expect(await addSong("ABC234", video, "Maya")).toBe("queue_full");
  });

  it("reports a server error when the answer is not the API's JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));
    expect(await addSong("ABC234", video, "Maya")).toBe("server_error");
  });

  it("reports a network error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await removeSong("ABC234", ITEM_ID)).toBe("network_error");
  });
});

describe("searchSongs", () => {
  it("asks for one kind of video in one session", async () => {
    const mock = stubFetch(200, { results: [video] });
    expect(await searchSongs("ABC234", "hello & goodbye", "lyrics")).toEqual({ results: [video] });
    expect(mock.mock.calls[0][0]).toBe("/api/search?code=ABC234&kind=lyrics&q=hello+%26+goodbye");
  });

  it("returns the error code when the search is refused", async () => {
    stubFetch(429, { ok: false, error: "rate_limited" });
    expect(await searchSongs("ABC234", "hello", "karaoke")).toEqual({ error: "rate_limited" });
  });

  it("returns a network error when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await searchSongs("ABC234", "hello", "karaoke")).toEqual({ error: "network_error" });
  });
});

describe("sessionStateUrl", () => {
  it("is the session's API address", () => {
    expect(sessionStateUrl("ABC234")).toBe("/api/sessions/ABC234");
  });
});

describe("fetchRecentSongs", () => {
  const songs = [{ videoId: "dQw4w9WgXcQ", title: "Valerie" }];

  it("returns the songs sung recently", async () => {
    const mock = stubFetch(200, { songs });
    expect(await fetchRecentSongs()).toEqual(songs);
    expect(sent(mock).url).toBe("/api/recent-songs");
  });

  it("returns nothing when they cannot be fetched", async () => {
    stubFetch(500, { ok: false, error: "server_error" });
    expect(await fetchRecentSongs()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await fetchRecentSongs()).toEqual([]);
  });
});
