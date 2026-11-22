import { describe, expect, it } from "vitest";
import { thumbnailUrl } from "@/lib/domain/video";
import { isUuid, parseAddSongRequest, parseMoveRequest, parseSettingsRequest, parsePlaybackRequest } from "@/lib/server/request-parsers";

const ITEM_ID = "3f2c1b7e-8a4d-4e6f-9b0a-1c2d3e4f5a6b";

describe("isUuid", () => {
  it("accepts UUIDs in either case and nothing else", () => {
    expect(isUuid(ITEM_ID)).toBe(true);
    expect(isUuid(ITEM_ID.toUpperCase())).toBe(true);
    expect(isUuid("3f2c1b7e")).toBe(false);
    expect(isUuid(`${ITEM_ID}'; drop table`)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("parseAddSongRequest", () => {
  const body = { videoId: "dQw4w9WgXcQ", title: " Never Gonna Give You Up ", channel: "Sing King", durationSeconds: 213.9, name: " Maya " };

  it("keeps the fields the queue stores", () => {
    expect(parseAddSongRequest(body)).toEqual({
      name: "Maya",
      video: {
        videoId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        channel: "Sing King",
        thumbnailUrl: thumbnailUrl("dQw4w9WgXcQ"),
        durationSeconds: 213,
      },
    });
  });

  it("never trusts a client-supplied image URL", () => {
    const parsed = parseAddSongRequest({ ...body, thumbnailUrl: "https://evil.example/x.png" });
    expect(parsed?.video.thumbnailUrl).toBe(thumbnailUrl("dQw4w9WgXcQ"));
  });

  it("fills in what is optional", () => {
    expect(parseAddSongRequest({ videoId: "dQw4w9WgXcQ", title: "Song" })).toEqual({
      name: "",
      video: { videoId: "dQw4w9WgXcQ", title: "Song", channel: "", thumbnailUrl: thumbnailUrl("dQw4w9WgXcQ"), durationSeconds: 0 },
    });
    expect(parseAddSongRequest({ ...body, durationSeconds: "long" })?.video.durationSeconds).toBe(0);
    expect(parseAddSongRequest({ ...body, durationSeconds: -5 })?.video.durationSeconds).toBe(0);
  });

  it("rejects a bad video id or a missing title", () => {
    expect(parseAddSongRequest({ ...body, videoId: "nope" })).toBeNull();
    expect(parseAddSongRequest({ ...body, title: "   " })).toBeNull();
    expect(parseAddSongRequest({ ...body, title: 5 })).toBeNull();
    expect(parseAddSongRequest({})).toBeNull();
  });
});

describe("parsePlaybackRequest", () => {
  it("accepts play, pause and next", () => {
    expect(parsePlaybackRequest({ action: "play" })).toEqual({ action: "play", expectedItemId: null });
    expect(parsePlaybackRequest({ action: "pause" })).toEqual({ action: "pause", expectedItemId: null });
    expect(parsePlaybackRequest({ action: "next", expectedItemId: ITEM_ID })).toEqual({ action: "next", expectedItemId: ITEM_ID });
  });

  it("drops an expected item id that is not a UUID", () => {
    expect(parsePlaybackRequest({ action: "next", expectedItemId: "abc" })).toEqual({ action: "next", expectedItemId: null });
  });

  it("rejects any other action", () => {
    expect(parsePlaybackRequest({ action: "stop" })).toBeNull();
    expect(parsePlaybackRequest({})).toBeNull();
  });
});

describe("parseMoveRequest", () => {
  it("reads the row to move after, or the top of the queue", () => {
    expect(parseMoveRequest({ afterId: ITEM_ID })).toEqual({ afterId: ITEM_ID });
    expect(parseMoveRequest({ afterId: null })).toEqual({ afterId: null });
    expect(parseMoveRequest({})).toEqual({ afterId: null });
  });

  it("rejects an id that is not a UUID", () => {
    expect(parseMoveRequest({ afterId: "top" })).toBeNull();
    expect(parseMoveRequest({ afterId: 3 })).toBeNull();
  });
});

describe("parseSettingsRequest", () => {
  it("reads whether singers take turns", () => {
    expect(parseSettingsRequest({ takeTurns: true })).toEqual({ takeTurns: true });
    expect(parseSettingsRequest({ takeTurns: false })).toEqual({ takeTurns: false });
  });

  it("rejects anything but true or false", () => {
    for (const takeTurns of ["true", 1, null, undefined]) expect(parseSettingsRequest({ takeTurns })).toBeNull();
  });
});
