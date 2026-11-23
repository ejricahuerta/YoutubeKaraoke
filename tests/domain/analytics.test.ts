import { describe, expect, it } from "vitest";
import { anonymizeAnalyticsUrl } from "@/lib/domain/analytics";

describe("anonymizeAnalyticsUrl", () => {
  it("replaces the session code on the main screen's page", () => {
    expect(anonymizeAnalyticsUrl("https://youoke.app/s/ABC234")).toBe("https://youoke.app/s/[code]");
  });

  it("replaces the session code on a phone's page, and anything after it", () => {
    expect(anonymizeAnalyticsUrl("https://youoke.app/join/ABC234")).toBe("https://youoke.app/join/[code]");
    expect(anonymizeAnalyticsUrl("https://youoke.app/join/ABC234/extra")).toBe("https://youoke.app/join/[code]");
  });

  it("replaces codes that are not valid too: a typo can still be someone's code", () => {
    expect(anonymizeAnalyticsUrl("https://youoke.app/join/abc23")).toBe("https://youoke.app/join/[code]");
  });

  it("drops the query string and hash, where a typed code can travel", () => {
    expect(anonymizeAnalyticsUrl("https://youoke.app/join?code=ABC234")).toBe("https://youoke.app/join");
    expect(anonymizeAnalyticsUrl("https://youoke.app/s/ABC234?x=1#top")).toBe("https://youoke.app/s/[code]");
  });

  it("leaves pages without a code as they are", () => {
    expect(anonymizeAnalyticsUrl("https://youoke.app/")).toBe("https://youoke.app/");
    expect(anonymizeAnalyticsUrl("https://youoke.app/privacy")).toBe("https://youoke.app/privacy");
    expect(anonymizeAnalyticsUrl("https://youoke.app/session/ABC234")).toBe("https://youoke.app/session/ABC234");
  });

  it("returns null for something that is not a URL, so nothing is sent", () => {
    expect(anonymizeAnalyticsUrl("not a url")).toBeNull();
  });
});
