/** Rules of the main screen's player that do not need a browser to decide. */

/** How far "forward" jumps, on screen and on a remote's fast-forward key. */
export const SEEK_STEP_SECONDS = 10;
/** The pause before each song so the singer can get to the mic. */
export const INTRO_SECONDS = 5;
/** The "up next" banner appears this long before the current song ends. */
export const UP_NEXT_BANNER_SECONDS = 30;
/** A reload resumes a song only when it was at least this far in. */
const RESUME_MIN_SECONDS = 5;

/** What every screen calls the song that is playing now. */
export const SINGING_LABEL = "Now playing";

/** The label over the current song. */
export function playingLabel(isPlaying: boolean): string {
  return isPlaying ? SINGING_LABEL : "Paused";
}

export type HostKeyCommand = "toggle" | "play" | "pause" | "next" | "forward";

/**
 * What a key press means on the main screen. Media keys (TV remotes, keyboards) work
 * anywhere; Space plays or pauses unless a control has focus, where it presses that control.
 */
export function hostKeyCommand(key: string, focusOnControl: boolean): HostKeyCommand | null {
  switch (key) {
    case "MediaPlayPause": return "toggle";
    case " ": return focusOnControl ? null : "toggle";
    case "MediaPlay": return "play";
    case "MediaPause": return "pause";
    case "MediaTrackNext": return "next";
    case "MediaFastForward": return "forward";
    default: return null;
  }
}

/** The stored volume as 0-100; full volume when nothing was stored. */
export function clampVolume(stored: string | null | undefined): number {
  return stored ? Math.min(100, Math.max(0, Number(stored) || 0)) : 100;
}

/** Where to resume a queue item after a page reload, from the saved JSON (0 = from the start). */
export function resumePosition(savedJson: string | null, itemId: string): number {
  try {
    const saved = JSON.parse(savedJson ?? "null");
    return saved?.itemId === itemId && saved.seconds > RESUME_MIN_SECONDS ? Math.floor(saved.seconds) : 0;
  } catch {
    return 0;
  }
}

export function upNextBannerVisible(p: { hasNext: boolean; intro: boolean; duration: number; seconds: number }): boolean {
  const remaining = p.duration - p.seconds;
  return p.hasNext && !p.intro && p.duration > 0 && remaining > 0 && remaining <= UP_NEXT_BANNER_SECONDS;
}
