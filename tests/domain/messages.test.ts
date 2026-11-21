import { describe, expect, it } from "vitest";
import { failureMessage, isFailure, startErrorMessage } from "@/lib/domain/messages";

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
