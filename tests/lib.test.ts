import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, generateCode, normalizeCode } from "@/lib/codes";
import { isPhone } from "@/lib/device";
import { buildSearchQuery, displayTitle, formatDuration, thumbnailFor } from "@/lib/format";
import { allow } from "@/lib/rate-limit";
import { formatWait, ordinal, singerIndex, singerInitial, waitSeconds } from "@/lib/singers";
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

describe("isPhone", () => {
  const h = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
  const ua = (value: string) => h({ "user-agent": value });

  it("detects phones", () => {
    expect(isPhone(ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"))).toBe(true);
    expect(isPhone(ua("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"))).toBe(true);
    expect(isPhone(h({ "sec-ch-ua-mobile": "?1", "user-agent": "Mozilla/5.0 (Linux; Android 10; K) Chrome/120" }))).toBe(true);
  });

  it("treats desktops, TVs and tablets as big screens", () => {
    expect(isPhone(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 Chrome/94.0 TV Safari/537.36"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"))).toBe(false);
    expect(isPhone(h({}))).toBe(false);
  });
});

describe("singers", () => {
  it("gives the same colour slot to the same name, ignoring case and spaces", () => {
    expect(singerIndex("Maya")).toBe(singerIndex("  maya "));
    for (const name of ["Maya", "Leo", "", "Zoë", "李"]) {
      expect(singerIndex(name)).toBeGreaterThanOrEqual(0);
      expect(singerIndex(name)).toBeLessThan(8);
    }
  });

  it("takes the first character as the initial", () => {
    expect(singerInitial(" maya")).toBe("M");
    expect(singerInitial("")).toBe("?");
  });

  it("estimates the wait before a queue position", () => {
    const queue = [{ durationSeconds: 200 }, { durationSeconds: 0 }, { durationSeconds: 100 }];
    expect(waitSeconds(null, queue, 0)).toBe(0);
    expect(waitSeconds({ durationSeconds: 240 }, queue, 0)).toBe(120); // unknown position: halfway
    expect(waitSeconds({ durationSeconds: 240 }, queue, 2, 200)).toBe(40 + 200 + 210); // 0 means unknown: 3.5 min
    expect(waitSeconds(null, queue, 99)).toBe(510);
  });

  it("words waits and positions the way people say them", () => {
    expect(formatWait(30)).toBe("any minute now");
    expect(formatWait(14 * 60)).toBe("about 14 min");
    expect(formatWait(60 * 60)).toBe("about 1 hr");
    expect(formatWait(75 * 60)).toBe("about 1 hr 15 min");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"],
    );
  });
});

describe("displayTitle", () => {
  it("drops video boilerplate but keeps the song", () => {
    expect(displayTitle("Dancing Queen (Karaoke Version)")).toBe("Dancing Queen");
    expect(displayTitle("ABBA - Dancing Queen [Official Lyric Video] (HD)")).toBe("ABBA - Dancing Queen");
    expect(displayTitle("Valerie - Amy Winehouse | Karaoke Version | KaraFun")).toBe("Valerie - Amy Winehouse");
    expect(displayTitle("Mr. Brightside - Karaoke")).toBe("Mr. Brightside");
    expect(displayTitle("Hello (Live at the BBC)")).toBe("Hello (Live at the BBC)");
    expect(displayTitle("(Karaoke)")).toBe("(Karaoke)");
  });
});
