import { describe, expect, it } from "vitest";
import { clampVolume, hostKeyCommand, resumePosition, upNextBannerVisible } from "@/lib/domain/playback";

describe("hostKeyCommand", () => {
  it("maps media keys wherever the focus is", () => {
    expect(hostKeyCommand("MediaPlayPause", true)).toBe("toggle");
    expect(hostKeyCommand("MediaPlay", true)).toBe("play");
    expect(hostKeyCommand("MediaPause", true)).toBe("pause");
    expect(hostKeyCommand("MediaTrackNext", true)).toBe("next");
    expect(hostKeyCommand("MediaFastForward", true)).toBe("forward");
  });

  it("uses Space to play or pause only when no control has focus", () => {
    expect(hostKeyCommand(" ", false)).toBe("toggle");
    expect(hostKeyCommand(" ", true)).toBeNull();
  });

  it("ignores every other key", () => {
    expect(hostKeyCommand("a", false)).toBeNull();
    expect(hostKeyCommand("Enter", false)).toBeNull();
  });
});

describe("clampVolume", () => {
  it("defaults to full volume when nothing is stored", () => {
    expect(clampVolume(null)).toBe(100);
    expect(clampVolume(undefined)).toBe(100);
    expect(clampVolume("")).toBe(100);
  });

  it("keeps stored values inside 0-100", () => {
    expect(clampVolume("35")).toBe(35);
    expect(clampVolume("0")).toBe(0);
    expect(clampVolume("250")).toBe(100);
    expect(clampVolume("-4")).toBe(0);
    expect(clampVolume("loud")).toBe(0);
  });
});

describe("resumePosition", () => {
  const saved = (itemId: string, seconds: number) => JSON.stringify({ itemId, seconds });

  it("resumes the same queue item where it was", () => {
    expect(resumePosition(saved("a", 61.7), "a")).toBe(61);
  });

  it("starts from the top for another item, the first few seconds, or bad data", () => {
    expect(resumePosition(saved("a", 61), "b")).toBe(0);
    expect(resumePosition(saved("a", 4), "a")).toBe(0);
    expect(resumePosition(null, "a")).toBe(0);
    expect(resumePosition("{not json", "a")).toBe(0);
    expect(resumePosition(JSON.stringify({ itemId: "a", seconds: "x" }), "a")).toBe(0);
  });
});

describe("upNextBannerVisible", () => {
  it("shows in the last 30 seconds of a song when someone is waiting", () => {
    expect(upNextBannerVisible({ hasNext: true, intro: false, duration: 200, seconds: 175 })).toBe(true);
    expect(upNextBannerVisible({ hasNext: true, intro: false, duration: 200, seconds: 100 })).toBe(false);
  });

  it("stays hidden with nobody waiting, during the intro, or before the length is known", () => {
    expect(upNextBannerVisible({ hasNext: false, intro: false, duration: 200, seconds: 190 })).toBe(false);
    expect(upNextBannerVisible({ hasNext: true, intro: true, duration: 200, seconds: 190 })).toBe(false);
    expect(upNextBannerVisible({ hasNext: true, intro: false, duration: 0, seconds: 0 })).toBe(false);
    expect(upNextBannerVisible({ hasNext: true, intro: false, duration: 200, seconds: 200 })).toBe(false);
  });
});
