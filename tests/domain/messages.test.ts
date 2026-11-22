import { describe, expect, it } from "vitest";
import { failureMessage, isFailure, mainScreenGoneNotice, startErrorMessage } from "@/lib/domain/messages";
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
  it("says nothing while the main screen is polling", () => {
    expect(mainScreenGoneNotice({ hostAwaySeconds: 20, closesInSeconds: 880 })).toBeNull();
    // The main screen's poll is only written once a minute, so a gap of a minute or two is normal.
    expect(mainScreenGoneNotice({ hostAwaySeconds: 140, closesInSeconds: 800 })).toBeNull();
  });

  it("warns once the main screen has been gone a few minutes, with the time left", () => {
    expect(mainScreenGoneNotice({ hostAwaySeconds: 300, closesInSeconds: 600 })).toBe(
      "The main screen seems to be closed, so nothing will play. If it stays closed, this session ends in about 10 min.",
    );
    expect(mainScreenGoneNotice({ hostAwaySeconds: 300, closesInSeconds: 61 })).toContain("ends in about 2 min");
    expect(mainScreenGoneNotice({ hostAwaySeconds: 900, closesInSeconds: 20 })).toContain("ends in under a minute");
  });

  it("says nothing when the database does not report it", () => {
    expect(mainScreenGoneNotice({ hostAwaySeconds: null, closesInSeconds: null })).toBeNull();
    expect(mainScreenGoneNotice({})).toBeNull();
  });
});
