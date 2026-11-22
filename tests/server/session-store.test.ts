import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSessionCode } from "@/lib/domain/session-code";

const rpc = vi.fn();
vi.mock("@/lib/server/supabase", () => ({ getSupabaseServerClient: () => ({ rpc }) }));

const { addQueueItem, createSession, endSession, generateSessionCode, getSessionState, updatePlayback } = await import("@/lib/server/session-store");

const answer = (data: unknown) => ({ data, error: null });

beforeEach(() => rpc.mockReset());

describe("generateSessionCode", () => {
  it("only makes codes that normalizeSessionCode accepts", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSessionCode();
      expect(normalizeSessionCode(code)).toBe(code);
    }
  });
});

describe("createSession", () => {
  it("returns the new code", async () => {
    rpc.mockResolvedValue(answer(true));
    const code = await createSession("hash");
    expect(rpc).toHaveBeenCalledWith("create_session", { p_code: code, p_host_hash: "hash" });
  });

  it("tries another code when one is taken", async () => {
    rpc.mockResolvedValueOnce(answer(false)).mockResolvedValueOnce(answer(true));
    const code = await createSession("hash");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1].p_code).toBe(code);
  });

  it("gives up after a few collisions", async () => {
    rpc.mockResolvedValue(answer(false));
    await expect(createSession("hash")).rejects.toThrow("Could not allocate a session code");
    expect(rpc).toHaveBeenCalledTimes(5);
  });
});

describe("database calls", () => {
  it("passes arguments under the names the database functions declare", async () => {
    rpc.mockResolvedValue(answer("ok"));
    await getSessionState("ABC234", "hash", "guest");
    expect(rpc).toHaveBeenLastCalledWith("get_state", { p_code: "ABC234", p_host_hash: "hash", p_guest_id: "guest" });

    await addQueueItem("ABC234", "guest", "Maya", { videoId: "v", title: "t", channel: "c", thumbnailUrl: "u", durationSeconds: 9 });
    expect(rpc).toHaveBeenLastCalledWith("add_item", {
      p_code: "ABC234", p_guest_id: "guest", p_name: "Maya",
      p_video_id: "v", p_title: "t", p_channel: "c", p_thumbnail_url: "u", p_duration_seconds: 9,
    });

    await endSession("ABC234", "hash");
    expect(rpc).toHaveBeenLastCalledWith("end_session", { p_code: "ABC234", p_host_hash: "hash" });

    await updatePlayback("ABC234", "hash", "next", "item");
    expect(rpc).toHaveBeenLastCalledWith("playback", { p_code: "ABC234", p_host_hash: "hash", p_action: "next", p_expected_item_id: "item" });
  });

  it("throws with the function name when the database reports an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getSessionState("ABC234", null, null)).rejects.toThrow("get_state failed: boom");
  });
});
