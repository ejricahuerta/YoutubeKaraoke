/** Which search runs: keyless first, the official API only when that fails and a key is set. */
import { afterEach, describe, expect, it, vi } from "vitest";

const keyless = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("youtubei.js", () => ({ Innertube: { create: async () => ({ search: keyless.search }) } }));
const dataApi = vi.hoisted(() => ({ searchWithDataApi: vi.fn() }));
vi.mock("@/lib/server/youtube-data-api", () => dataApi);

const { searchVideos } = await import("@/lib/server/youtube-search");

const result = { videoId: "dQw4w9WgXcQ", title: "From the API", channel: "c", thumbnailUrl: "t", durationSeconds: 200 };

afterEach(() => {
  vi.unstubAllEnvs();
  keyless.search.mockReset();
  dataApi.searchWithDataApi.mockReset();
  vi.spyOn(console, "warn").mockRestore();
});

describe("searchVideos", () => {
  it("uses keyless search and never the official API while it works, even with a key set", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 }))); // the embeddable check
    keyless.search.mockResolvedValue({ results: [] });
    expect(await searchVideos("works fine")).toEqual([]);
    expect(dataApi.searchWithDataApi).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the official API when keyless search fails and a key is set", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "k");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    keyless.search.mockRejectedValue(new Error("YouTube changed something"));
    dataApi.searchWithDataApi.mockResolvedValue([result]);
    expect(await searchVideos("keyless broke")).toEqual([result]);
    expect(dataApi.searchWithDataApi).toHaveBeenCalledWith("keyless broke", "k");
  });

  it("fails as before when keyless search fails and there is no key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    keyless.search.mockRejectedValue(new Error("YouTube changed something"));
    await expect(searchVideos("no key")).rejects.toThrow("YouTube changed something");
    expect(dataApi.searchWithDataApi).not.toHaveBeenCalled();
  });

  it("caches what the fallback found, so a busy night does not spend the API's daily quota", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "k");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    keyless.search.mockRejectedValue(new Error("down"));
    dataApi.searchWithDataApi.mockResolvedValue([result]);
    await searchVideos("cached query");
    await searchVideos("cached query");
    expect(dataApi.searchWithDataApi).toHaveBeenCalledTimes(1);
  });
});
