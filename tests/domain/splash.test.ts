import { describe, expect, it } from "vitest";
import { createSplashClock, SPLASH_HANDOVER_MS } from "@/lib/domain/splash";

describe("the splash screen's clock", () => {
  it("starts the logo's intro from the top the first time a splash shows", () => {
    const clock = createSplashClock();
    expect(clock.elapsedMs(1000)).toBe(0);
  });

  it("carries on where it was when one splash takes over from another, so the intro does not replay", () => {
    const clock = createSplashClock();
    clock.elapsedMs(1000);
    clock.shown();
    // The next screen's splash draws while the last one is still up, then the last one goes.
    expect(clock.elapsedMs(1800)).toBe(800);
    clock.shown();
    clock.hidden(1800);
    expect(clock.elapsedMs(1800 + SPLASH_HANDOVER_MS)).toBe(800 + SPLASH_HANDOVER_MS);
  });

  it("plays the intro again once every splash has been gone for a while", () => {
    const clock = createSplashClock();
    clock.elapsedMs(1000);
    clock.shown();
    clock.hidden(2000);
    expect(clock.elapsedMs(2000 + SPLASH_HANDOVER_MS + 1)).toBe(0);
  });
});
