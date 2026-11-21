import { describe, expect, it } from "vitest";
import { buildSearchQuery, displayTitle, isVideoId, SEARCH_QUERY_MAX_LENGTH, thumbnailUrl } from "@/lib/domain/video";

describe("isVideoId", () => {
  it("accepts 11-character YouTube ids only", () => {
    expect(isVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isVideoId("a_b-c_d-e_f")).toBe(true);
    expect(isVideoId("bad id")).toBe(false);
    expect(isVideoId("dQw4w9WgXcQ/../x")).toBe(false);
    expect(isVideoId(42)).toBe(false);
  });
});

describe("thumbnailUrl", () => {
  it("builds the YouTube image URL for a list row or a poster", () => {
    expect(thumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
    expect(thumbnailUrl("dQw4w9WgXcQ", "poster")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("buildSearchQuery", () => {
  it("appends the kind once", () => {
    expect(buildSearchQuery("  bohemian   rhapsody ", "karaoke")).toBe("bohemian rhapsody karaoke");
    expect(buildSearchQuery("Bohemian Rhapsody Karaoke", "karaoke")).toBe("Bohemian Rhapsody Karaoke");
    expect(buildSearchQuery("hello adele", "lyrics")).toBe("hello adele lyrics");
  });

  it("returns an empty string for a blank query", () => {
    expect(buildSearchQuery("   ", "karaoke")).toBe("");
  });

  it("cuts very long input before adding the kind", () => {
    const query = buildSearchQuery("a".repeat(500), "karaoke");
    expect(query).toBe(`${"a".repeat(SEARCH_QUERY_MAX_LENGTH)} karaoke`);
  });
});

describe("displayTitle", () => {
  it("drops video boilerplate but keeps the song", () => {
    expect(displayTitle("Dancing Queen (Karaoke Version)")).toBe("Dancing Queen");
    expect(displayTitle("ABBA - Dancing Queen [Official Lyric Video] (HD)")).toBe("ABBA - Dancing Queen");
    expect(displayTitle("Valerie - Amy Winehouse | Karaoke Version | KaraFun")).toBe("Valerie - Amy Winehouse");
    expect(displayTitle("Mr. Brightside - Karaoke")).toBe("Mr. Brightside");
  });

  it("keeps brackets that are part of the song", () => {
    expect(displayTitle("Hello (Live at the BBC)")).toBe("Hello (Live at the BBC)");
  });

  it("never returns an empty title", () => {
    expect(displayTitle("(Karaoke)")).toBe("(Karaoke)");
  });
});
