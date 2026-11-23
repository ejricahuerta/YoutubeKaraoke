/**
 * How long every splash may be gone before the next one plays the logo's intro again.
 * Shorter gaps are one screen handing its splash to the next (the guest view checks the
 * room, then loads the session), and the animation should carry on rather than restart.
 */
export const SPLASH_HANDOVER_MS = 300;

/**
 * Keeps one animation clock for all the splash screens on a page, in milliseconds of any
 * steady clock (`performance.now()` in the browser).
 * `elapsedMs` is asked when a splash draws; `shown` and `hidden` follow it on and off the page.
 */
export function createSplashClock() {
  let startedAt = 0;
  let showing = 0;
  let hiddenAt = Number.NEGATIVE_INFINITY;
  return {
    /** How far into its animation a splash drawn at `now` should start. */
    elapsedMs(now: number): number {
      if (showing === 0 && now - hiddenAt > SPLASH_HANDOVER_MS) startedAt = now;
      return now - startedAt;
    },
    shown() {
      showing += 1;
    },
    hidden(now: number) {
      showing = Math.max(0, showing - 1);
      if (showing === 0) hiddenAt = now;
    },
  };
}
