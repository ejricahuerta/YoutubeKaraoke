"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createSplashClock } from "@/lib/domain/splash";
import { LogoMark, Wordmark } from "./Logo";

/** One clock for every splash on the page, so a splash taking over from another carries on its animation. */
const clock = createSplashClock();

/**
 * The full-page splash: the logo builds itself (tile, singer, K, then the ball drops on),
 * the name rises in under it, and the ball keeps hopping until the screen is ready.
 * Sized from the viewport, so it reads the same on a phone and across the room on a TV.
 */
export function SplashScreen({ caption = "Setting the stage…" }: { caption?: string }) {
  // The server and the first draw in the browser both start at 0, so hydration matches.
  const [elapsedMs] = useState(() => (typeof window === "undefined" ? 0 : clock.elapsedMs(performance.now())));
  useEffect(() => {
    clock.shown();
    return () => clock.hidden(performance.now());
  }, []);

  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center overflow-hidden p-6 text-center"
      style={{ "--splash-ms": `${Math.round(elapsedMs)}ms` } as CSSProperties}
    >
      <div className="flex flex-col items-center">
        <LogoMark animated className="h-[clamp(5.5rem,20vmin,12rem)] w-[clamp(5.5rem,20vmin,12rem)]" />
        <span className="splash-name mt-[clamp(1.25rem,4vmin,2.5rem)] font-display text-[clamp(2.25rem,8vmin,5rem)] font-extrabold leading-none tracking-tight">
          <Wordmark />
        </span>
        <p className="splash-caption mt-[clamp(0.75rem,2vmin,1.5rem)] text-[clamp(1rem,2.6vmin,1.75rem)] text-ink-muted">{caption}</p>
      </div>
    </div>
  );
}
