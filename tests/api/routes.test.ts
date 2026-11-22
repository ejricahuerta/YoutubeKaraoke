/** The route handlers end to end, with the database and cookies replaced by fakes. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = {
  getSessionState: vi.fn(),
  addQueueItem: vi.fn(),
  removeQueueItem: vi.fn(),
  moveQueueItem: vi.fn(),
  updatePlayback: vi.fn(),
  endSession: vi.fn(),
  setTakeTurns: vi.fn(),
  claimRemote: vi.fn(),
  freeRemote: vi.fn(),
  createSession: vi.fn(),
};
vi.mock("@/lib/server/session-store", () => store);
const clearHostCookie = vi.fn();
vi.mock("@/lib/server/auth", () => ({
  getHostTokenHash: async () => "host-hash",
  getOrCreateGuestId: async () => "guest-1",
  createHostToken: () => "token",
  hashHostToken: () => "host-hash",
  setHostCookie: vi.fn(),
  clearHostCookie,
}));
const searchVideos = vi.fn();
vi.mock("@/lib/server/youtube-search", () => ({ searchVideos }));

const sessionRoute = await import("@/app/api/sessions/[code]/route");
const queueRoute = await import("@/app/api/sessions/[code]/queue/route");
const itemRoute = await import("@/app/api/sessions/[code]/queue/[id]/route");
const playbackRoute = await import("@/app/api/sessions/[code]/playback/route");
const remoteRoute = await import("@/app/api/sessions/[code]/remote/route");
const sessionsRoute = await import("@/app/api/sessions/route");
const searchRoute = await import("@/app/api/search/route");

const ITEM_ID = "3f2c1b7e-8a4d-4e6f-9b0a-1c2d3e4f5a6b";
const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });
const json = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method, body: body === undefined ? undefined : JSON.stringify(body), headers });
const live = { code: "ABC234", archived: false, isPlaying: true, isHost: false, current: null, queue: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/sessions/[code]", () => {
  it("returns the state for this browser's host token and guest id, uncached", async () => {
    store.getSessionState.mockResolvedValue(live);
    const res = await sessionRoute.GET(json("GET"), ctx({ code: "abc234" }));
    expect(await res.json()).toEqual(live);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(store.getSessionState).toHaveBeenCalledWith("ABC234", "host-hash", "guest-1");
  });

  it("answers 404 for a session that does not exist", async () => {
    store.getSessionState.mockResolvedValue(null);
    expect((await sessionRoute.GET(json("GET"), ctx({ code: "ABC234" }))).status).toBe(404);
  });

  it("keeps the host cookie while this browser hosts a live session", async () => {
    store.getSessionState.mockResolvedValue({ ...live, isHost: true });
    await sessionRoute.GET(json("GET"), ctx({ code: "ABC234" }));
    expect(clearHostCookie).not.toHaveBeenCalled();
  });

  it("drops a host cookie that can never be used again", async () => {
    for (const state of [null, { ...live, isHost: true, archived: true }, { ...live, isHost: false }]) {
      clearHostCookie.mockClear();
      store.getSessionState.mockResolvedValue(state);
      await sessionRoute.GET(json("GET"), ctx({ code: "ABC234" }));
      expect(clearHostCookie).toHaveBeenCalledWith("ABC234");
    }
  });

  it("answers 500 JSON when the database is down", async () => {
    store.getSessionState.mockRejectedValue(new Error("get_state failed"));
    const res = await sessionRoute.GET(json("GET"), ctx({ code: "ABC234" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "server_error" });
  });
});

describe("DELETE /api/sessions/[code]", () => {
  it("ends the session with this browser's host token, and lets the database decide", async () => {
    store.endSession.mockResolvedValue("ok");
    const res = await sessionRoute.DELETE(json("DELETE"), ctx({ code: "abc234" }));
    expect(await res.json()).toEqual({ ok: true, result: "ok" });
    expect(store.endSession).toHaveBeenCalledWith("ABC234", "host-hash");
  });

  it("passes a refusal on", async () => {
    store.endSession.mockResolvedValue("forbidden");
    expect((await sessionRoute.DELETE(json("DELETE"), ctx({ code: "ABC234" }))).status).toBe(403);
  });
});

describe("PATCH /api/sessions/[code]", () => {
  it("switches taking turns with this browser's host token, and lets the database decide", async () => {
    store.setTakeTurns.mockResolvedValue("ok");
    const res = await sessionRoute.PATCH(json("PATCH", { takeTurns: false }), ctx({ code: "abc234" }));
    expect(await res.json()).toEqual({ ok: true, result: "ok" });
    expect(store.setTakeTurns).toHaveBeenCalledWith("ABC234", "host-hash", false);
  });

  it("refuses a body without a yes or no", async () => {
    expect((await sessionRoute.PATCH(json("PATCH", { takeTurns: "no" }), ctx({ code: "ABC234" }))).status).toBe(400);
    expect(store.setTakeTurns).not.toHaveBeenCalled();
  });

  it("passes a refusal on", async () => {
    store.setTakeTurns.mockResolvedValue("forbidden");
    expect((await sessionRoute.PATCH(json("PATCH", { takeTurns: true }), ctx({ code: "ABC234" }))).status).toBe(403);
  });
});

describe("/api/sessions/[code]/remote", () => {
  it("POST asks for a freed remote for this browser's guest id", async () => {
    store.claimRemote.mockResolvedValue("ok");
    const res = await remoteRoute.POST(json("POST"), ctx({ code: "abc234" }));
    expect(await res.json()).toEqual({ ok: true, result: "ok" });
    expect(store.claimRemote).toHaveBeenCalledWith("ABC234", "guest-1");
  });

  it("POST passes on that someone already has it", async () => {
    store.claimRemote.mockResolvedValue("forbidden");
    expect((await remoteRoute.POST(json("POST"), ctx({ code: "ABC234" }))).status).toBe(403);
  });

  it("DELETE frees the remote with this browser's host token and guest id, and lets the database decide", async () => {
    store.freeRemote.mockResolvedValue("ok");
    const res = await remoteRoute.DELETE(json("DELETE"), ctx({ code: "abc234" }));
    expect(await res.json()).toEqual({ ok: true, result: "ok" });
    expect(store.freeRemote).toHaveBeenCalledWith("ABC234", "host-hash", "guest-1");
  });
});

describe("POST /api/sessions/[code]/queue", () => {
  const song = { videoId: "dQw4w9WgXcQ", title: "Song", name: "Maya" };

  it("adds the song for this guest", async () => {
    store.addQueueItem.mockResolvedValue("ok");
    const res = await queueRoute.POST(json("POST", song), ctx({ code: "ABC234" }));
    expect(res.status).toBe(200);
    expect(store.addQueueItem).toHaveBeenCalledWith("ABC234", "host-hash", "guest-1", "Maya", expect.objectContaining({ videoId: "dQw4w9WgXcQ", title: "Song" }));
  });

  it("rejects a body that is not a song without asking the database", async () => {
    const res = await queueRoute.POST(json("POST", { videoId: "x" }), ctx({ code: "ABC234" }));
    expect(res.status).toBe(400);
    expect(store.addQueueItem).not.toHaveBeenCalled();
  });

  it("passes the database's refusal on with its status", async () => {
    store.addQueueItem.mockResolvedValue("queue_full");
    const res = await queueRoute.POST(json("POST", song), ctx({ code: "ABC234" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "queue_full" });
  });
});

describe("/api/sessions/[code]/queue/[id]", () => {
  it("removes a song as this browser: host token and guest id both go to the database, which decides", async () => {
    store.removeQueueItem.mockResolvedValue("forbidden");
    const res = await itemRoute.DELETE(json("DELETE"), ctx({ code: "ABC234", id: ITEM_ID }));
    expect(res.status).toBe(403);
    expect(store.removeQueueItem).toHaveBeenCalledWith("ABC234", ITEM_ID, "host-hash", "guest-1");
  });

  it("moves a song after another, or to the top", async () => {
    store.moveQueueItem.mockResolvedValue("ok");
    await itemRoute.PATCH(json("PATCH", { afterId: null }), ctx({ code: "ABC234", id: ITEM_ID }));
    expect(store.moveQueueItem).toHaveBeenCalledWith("ABC234", "host-hash", "guest-1", ITEM_ID, null);
  });

  it("answers 404 for an id that is not a UUID and 400 for a bad target", async () => {
    expect((await itemRoute.DELETE(json("DELETE"), ctx({ code: "ABC234", id: "1" }))).status).toBe(404);
    expect((await itemRoute.PATCH(json("PATCH", { afterId: "top" }), ctx({ code: "ABC234", id: ITEM_ID }))).status).toBe(400);
    expect(store.moveQueueItem).not.toHaveBeenCalled();
  });
});

describe("POST /api/sessions/[code]/playback", () => {
  it("forwards the action with the song the host expects to be playing", async () => {
    store.updatePlayback.mockResolvedValue("stale");
    const res = await playbackRoute.POST(json("POST", { action: "next", expectedItemId: ITEM_ID }), ctx({ code: "ABC234" }));
    expect(await res.json()).toEqual({ ok: true, result: "stale" });
    expect(store.updatePlayback).toHaveBeenCalledWith("ABC234", "host-hash", "guest-1", "next", ITEM_ID);
  });

  it("rejects an unknown action", async () => {
    expect((await playbackRoute.POST(json("POST", { action: "rewind" }), ctx({ code: "ABC234" }))).status).toBe(400);
  });
});

describe("POST /api/sessions", () => {
  const desktop = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36" };
  const phone = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1" };

  it("starts a session and sends a big screen to it", async () => {
    store.createSession.mockResolvedValue("ABC234");
    const res = await sessionsRoute.POST(json("POST", undefined, { ...desktop, "x-forwarded-for": "198.51.100.1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/s/ABC234");
    expect(store.createSession).toHaveBeenCalledWith("host-hash");
  });

  it("answers with JSON when asked to", async () => {
    store.createSession.mockResolvedValue("ABC234");
    const res = await sessionsRoute.POST(json("POST", undefined, { ...desktop, accept: "application/json", "x-forwarded-for": "198.51.100.2" }));
    expect(await res.json()).toEqual({ ok: true, code: "ABC234" });
  });

  it("sends a phone back to the start page without creating anything", async () => {
    const res = await sessionsRoute.POST(json("POST", undefined, phone));
    expect(res.headers.get("location")).toBe("/");
    expect(store.createSession).not.toHaveBeenCalled();
  });

  it("limits how many sessions one address can start per minute, sending a form post back with the reason", async () => {
    store.createSession.mockResolvedValue("ABC234");
    const headers = { ...desktop, "x-forwarded-for": "198.51.100.3" };
    const responses = [];
    for (let i = 0; i < 11; i++) responses.push(await sessionsRoute.POST(json("POST", undefined, headers)));
    expect(responses.slice(0, 10).every((r) => r.headers.get("location") === "/s/ABC234")).toBe(true);
    expect(responses[10].status).toBe(303);
    expect(responses[10].headers.get("location")).toBe("/?error=slow_down");
  });

  it("answers a script over the limit with 429 JSON", async () => {
    store.createSession.mockResolvedValue("ABC234");
    const headers = { ...desktop, accept: "application/json", "x-forwarded-for": "198.51.100.4" };
    let last = new Response();
    for (let i = 0; i < 11; i++) last = await sessionsRoute.POST(json("POST", undefined, headers));
    expect(last.status).toBe(429);
    expect(await last.json()).toEqual({ ok: false, error: "rate_limited" });
  });

  it("sends a form post back to the start page when the database is down", async () => {
    store.createSession.mockRejectedValue(new Error("create_session failed"));
    const res = await sessionsRoute.POST(json("POST", undefined, { ...desktop, "x-forwarded-for": "198.51.100.5" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?error=unavailable");
  });

  it("answers a script with 500 JSON when the database is down", async () => {
    store.createSession.mockRejectedValue(new Error("create_session failed"));
    const res = await sessionsRoute.POST(json("POST", undefined, { ...desktop, accept: "application/json", "x-forwarded-for": "198.51.100.6" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "server_error" });
  });
});

describe("GET /api/search", () => {
  const search = (query: string, ip = "198.51.100.10") =>
    searchRoute.GET(new Request(`http://localhost/api/search?${query}`, { headers: { "x-forwarded-for": ip } }));

  it("searches for karaoke videos by default, for people in a live session", async () => {
    store.getSessionState.mockResolvedValue(live);
    searchVideos.mockResolvedValue([{ videoId: "dQw4w9WgXcQ" }]);
    const res = await search("code=abc234&q=hello");
    expect(await res.json()).toEqual({ results: [{ videoId: "dQw4w9WgXcQ" }] });
    expect(searchVideos).toHaveBeenCalledWith("hello karaoke");
  });

  it("returns nothing for a blank query without touching the database or YouTube", async () => {
    expect(await (await search("code=ABC234&q=+")).json()).toEqual({ results: [] });
    expect(store.getSessionState).not.toHaveBeenCalled();
    expect(searchVideos).not.toHaveBeenCalled();
  });

  it("is not an open proxy: no live session, no search", async () => {
    store.getSessionState.mockResolvedValue({ ...live, archived: true });
    expect((await search("code=ABC234&q=hello")).status).toBe(404);
    store.getSessionState.mockResolvedValue(null);
    expect((await search("code=ABC234&q=hello")).status).toBe(404);
    expect((await search("q=hello")).status).toBe(404);
    expect(searchVideos).not.toHaveBeenCalled();
  });

  it("answers 502 when YouTube search fails", async () => {
    store.getSessionState.mockResolvedValue(live);
    searchVideos.mockRejectedValue(new Error("timed out"));
    const res = await search("code=ABC234&kind=lyrics&q=hello");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "search_unavailable" });
  });

  it("limits searches per address", async () => {
    store.getSessionState.mockResolvedValue(live);
    searchVideos.mockResolvedValue([]);
    let last = 200;
    for (let i = 0; i < 41; i++) last = (await search("code=ABC234&q=hello", "198.51.100.99")).status;
    expect(last).toBe(429);
  });
});
