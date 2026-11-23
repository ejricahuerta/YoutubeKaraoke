import { describe, expect, it } from "vitest";
import { failureMessage, idleNotice, isFailure, mainScreenGoneNotice, startErrorMessage, timeLimitNotice } from "@/lib/domain/messages";
import { MAX_WAITING_SONGS } from "@/lib/domain/singers";

describe("isFailure", () => {
  it("treats ok and stale as success: stale means someone else already did it", () => {
    expect(isFailure("ok")).toBe(false);
    expect(isFailure("stale")).toBe(false);
  });

  it("treats every refusal and every missing answer as a failure", () => {
    for (const outcome of ["forbidden", "archived", "not_found", "queue_full", "rate_limited", "server_error", "network_error"] as const) {
      expect(isFailure(outcome)).toBe(true);
    }
  });
});

describe("failureMessage", () => {
  it("has plain words for the failures people can do something about", () => {
    expect(failureMessage("network_error", "x")).toMatch(/offline/i);
    expect(failureMessage("queue_full", "x")).toMatch(/queue is full/i);
    expect(failureMessage("rate_limited", "x")).toMatch(/wait/i);
    expect(failureMessage("forbidden", "x")).toMatch(/main screen/i);
    expect(failureMessage("guest_limit", "x")).toBe(`You already have ${MAX_WAITING_SONGS} songs waiting. Add another once one is sung.`);
  });

  it("says the session ended whether it was archived or is gone", () => {
    expect(failureMessage("archived", "x")).toBe(failureMessage("not_found", "x"));
  });

  it("falls back to what the caller was trying to do", () => {
    expect(failureMessage("server_error", "Couldn't remove that song. Try again.")).toBe("Couldn't remove that song. Try again.");
  });
});

describe("startErrorMessage", () => {
  it("explains why a session could not be started", () => {
    expect(startErrorMessage("unavailable")).toMatch(/couldn't start/i);
    expect(startErrorMessage("slow_down")).toMatch(/wait/i);
  });

  it("is null for no error or one it does not know, so a crafted link shows nothing", () => {
    expect(startErrorMessage(undefined)).toBeNull();
    expect(startErrorMessage("<script>")).toBeNull();
  });
});

describe("mainScreenGoneNotice", () => {
  it("says nothing while the main screen is there", () => {
    expect(mainScreenGoneNotice({ mainScreenAway: false, closesInSeconds: 880 })).toBeNull();
  });

  it("says nothing is playing, and when the session ends, once the database says the main screen is away", () => {
    expect(mainScreenGoneNotice({ mainScreenAway: true, closesInSeconds: 600 })).toBe(
      "The main screen is away, so nothing is playing. If it doesn't come back, this session ends in about 10 min.",
    );
    expect(mainScreenGoneNotice({ mainScreenAway: true, closesInSeconds: 61 })).toContain("ends in about 2 min");
    expect(mainScreenGoneNotice({ mainScreenAway: true, closesInSeconds: 20 })).toContain("ends in under a minute");
  });

  it("says nothing when the database does not report it", () => {
    expect(mainScreenGoneNotice({ mainScreenAway: undefined, closesInSeconds: null })).toBeNull();
    expect(mainScreenGoneNotice({})).toBeNull();
  });
});

describe("idleNotice", () => {
  it("warns the main screen when an idle session is about to end, and only then", () => {
    expect(idleNotice({ hasSongs: false, closesInSeconds: 540 })).toBe("Nothing's queued. This session ends in about 9 min unless someone adds a song.");
    expect(idleNotice({ hasSongs: false, closesInSeconds: 30 })).toContain("ends in under a minute");
    expect(idleNotice({ hasSongs: false, closesInSeconds: 1200 })).toBeNull();
    expect(idleNotice({ hasSongs: true, closesInSeconds: 300 })).toBeNull();
    expect(idleNotice({ hasSongs: false, closesInSeconds: null })).toBeNull();
  });
});

describe("timeLimitNotice", () => {
  it("warns everyone when the session's hour is nearly up, and only then", () => {
    expect(timeLimitNotice({ limitInSeconds: 540 })).toBe("Sessions last an hour at most, so this one ends in about 9 min.");
    expect(timeLimitNotice({ limitInSeconds: 30 })).toContain("ends in under a minute");
    expect(timeLimitNotice({ limitInSeconds: 1200 })).toBeNull();
  });

  it("says nothing when the database does not report it", () => {
    expect(timeLimitNotice({ limitInSeconds: null })).toBeNull();
    expect(timeLimitNotice({})).toBeNull();
  });
});

describe("main screen results", () => {
  it("explain why a phone cannot play, or why the main screen cannot be moved", () => {
    expect(failureMessage("main_screen_away", "x")).toMatch(/main screen is away/i);
    expect(failureMessage("main_screen_here", "x")).toMatch(/main screen is back/i);
  });
});
