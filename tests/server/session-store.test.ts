import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSessionCode } from "@/lib/domain/session-code";

const rpc = vi.fn();
let secretClientUsed = false;
vi.mock("@/lib/server/supabase", () => ({
  getSupabaseServerClient: () => ({ rpc }),
  // Only start_session needs the secret key (ADR 0026).
  getSupabaseSecretClient: () => {
    secretClientUsed = true;
    return { rpc };
  },
}));

const { addQueueItem, createSession, endSession, generateSessionCode, getRecentlyPlayedVideoIds, getSessionState, moveQueueItem, playQueueItem, updatePlayback } =
  await import("@/lib/server/session-store");

const answer = (data: unknown) => ({ data, error: null });

beforeEach(() => {
  rpc.mockReset();
  secretClientUsed = false;
});

describe("generateSessionCode", () => {
  it("only makes codes that normalizeSessionCode accepts", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSessionCode();
      expect(normalizeSessionCode(code)).toBe(code);
    }
  });
});

describe("createSession", () => {
  it("returns the new code, for the browser that started it", async () => {
    rpc.mockResolvedValue(answer({ result: "ok" }));
    const started = await createSession("hash", "guest", "net");
    expect(started).toEqual({ code: expect.any(String) });
    expect(rpc).toHaveBeenCalledWith("start_session", {
      p_code: "code" in started && started.code, p_host_hash: "hash", p_guest_id: "guest", p_network: "net",
    });
    expect(secretClientUsed).toBe(true);
  });

  it("tries another code when one is taken", async () => {
    rpc.mockResolvedValueOnce(answer({ result: "taken" })).mockResolvedValueOnce(answer({ result: "ok" }));
    const started = await createSession("hash", "guest", "net");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(started).toEqual({ code: rpc.mock.calls[1][1].p_code });
  });

  it("says how long to wait after this browser's session ran its full hour", async () => {
    rpc.mockResolvedValue(answer({ result: "wait", waitSeconds: 780 }));
    expect(await createSession("hash", "guest", "net")).toEqual({ waitSeconds: 780 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("gives up after a few collisions", async () => {
    rpc.mockResolvedValue(answer({ result: "taken" }));
    await expect(createSession("hash", "guest", "net")).rejects.toThrow("Could not allocate a session code");
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it("fails on any other answer", async () => {
    rpc.mockResolvedValue(answer({ result: "invalid" }));
    await expect(createSession("hash", "", "net")).rejects.toThrow("start_session answered invalid");
  });
});

describe("database calls", () => {
  it("passes arguments under the names the database functions declare", async () => {
    rpc.mockResolvedValue(answer("ok"));
    await getSessionState("ABC234", "hash", "guest");
    expect(rpc).toHaveBeenLastCalledWith("get_state", { p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest" });

    await addQueueItem("ABC234", "hash", "guest", "Maya", { videoId: "v", title: "t", channel: "c", thumbnailUrl: "u", durationSeconds: 9 });
    expect(rpc).toHaveBeenLastCalledWith("add_item", {
      p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest", p_name: "Maya",
      p_video_id: "v", p_title: "t", p_channel: "c", p_thumbnail_url: "u", p_duration_seconds: 9,
    });

    await endSession("ABC234", "hash");
    expect(rpc).toHaveBeenLastCalledWith("end_session", { p_code: "ABC234", p_host_hash: "hash" });

    await updatePlayback("ABC234", "hash", "guest", "next", "item");
    expect(rpc).toHaveBeenLastCalledWith("playback", {
      p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest", p_action: "next", p_expected_item_id: "item",
    });

    await playQueueItem("ABC234", "hash", "guest", "item", "current");
    expect(rpc).toHaveBeenLastCalledWith("play_item", {
      p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest", p_item_id: "item", p_expected_item_id: "current",
    });

    await moveQueueItem("ABC234", "hash", "guest", "item", null);
    expect(rpc).toHaveBeenLastCalledWith("move_item", { p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest", p_item_id: "item", p_after_id: null });
  });

  it("asks for the songs sung recently in any session, as video ids", async () => {
    rpc.mockResolvedValue(answer(["dQw4w9WgXcQ"]));
    expect(await getRecentlyPlayedVideoIds()).toEqual(["dQw4w9WgXcQ"]);
    expect(rpc).toHaveBeenLastCalledWith("recently_played", {});
  });

  it("throws with the function name when the database reports an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getSessionState("ABC234", null, null)).rejects.toThrow("get_state failed: boom");
  });
});
