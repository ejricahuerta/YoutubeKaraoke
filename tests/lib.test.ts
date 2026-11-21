import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, generateCode, normalizeCode } from "@/lib/codes";
import { buildSearchQuery, formatDuration, thumbnailFor } from "@/lib/format";
import { allow } from "@/lib/rate-limit";
import { mapVideoNode } from "@/lib/youtube-search";

describe("session codes", () => {
  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
      expect(normalizeCode(code)).toBe(code);
    }
  });

  it("normalizes case and whitespace, rejects anything else", () => {
    expect(normalizeCode(" abc234 ")).toBe("ABC234");
    expect(normalizeCode("ABC23")).toBeNull();
    expect(normalizeCode("ABC2345")).toBeNull();
    expect(normalizeCode("ABC10O")).toBeNull(); // 1, 0 and O are excluded
    expect(normalizeCode("../../x")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });
});

describe("search query", () => {
  it("appends the kind once", () => {
    expect(buildSearchQuery("  bohemian   rhapsody ", "karaoke")).toBe("bohemian rhapsody karaoke");
    expect(buildSearchQuery("Bohemian Rhapsody Karaoke", "karaoke")).toBe("Bohemian Rhapsody Karaoke");
    expect(buildSearchQuery("hello adele", "lyrics")).toBe("hello adele lyrics");
    expect(buildSearchQuery("   ", "karaoke")).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

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
      thumbnailUrl: thumbnailFor("dQw4w9WgXcQ"),
      durationSeconds: 213,
    });
  });

  it("drops non-videos, live streams, and malformed entries", () => {
    expect(mapVideoNode({ ...node, type: "Channel" })).toBeNull();
    expect(mapVideoNode({ ...node, is_live: true })).toBeNull();
    expect(mapVideoNode({ ...node, duration: { seconds: 0 } })).toBeNull();
    expect(mapVideoNode({ ...node, video_id: "bad id" })).toBeNull();
    expect(mapVideoNode({ ...node, title: { text: "" } })).toBeNull();
    expect(mapVideoNode(null)).toBeNull();
  });
});

describe("rate limit", () => {
  it("allows up to the limit per minute, then recovers", () => {
    const key = `test:${Math.random()}`;
    expect(allow(key, 2, 1000)).toBe(true);
    expect(allow(key, 2, 2000)).toBe(true);
    expect(allow(key, 2, 3000)).toBe(false);
    expect(allow(key, 2, 62_000)).toBe(true);
  });
});
