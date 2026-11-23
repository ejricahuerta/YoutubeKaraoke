"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/client/browser-hooks";

/**
 * Shows one of `words` at a time, rolling up to the next every `everyMs`. It is decoration:
 * hidden from screen readers, so put the steady wording beside it in an `sr-only` span, and
 * held on the first word for people who asked for less motion.
 * `className` sets the display (`inline-grid` by default) and the look.
 */
export function RotatingWords({ words, everyMs, className = "inline-grid" }: { words: readonly string[]; everyMs: number; className?: string }) {
  const still = usePrefersReducedMotion();
  // How many times it has rolled; each word gets it as its key, so it animates in afresh.
  const [rolls, setRolls] = useState(0);
  useEffect(() => {
    if (still || words.length < 2) return;
    const timer = setInterval(() => setRolls((n) => n + 1), everyMs);
    return () => clearInterval(timer);
  }, [still, words.length, everyMs]);

  const shown = still ? 0 : rolls;
  return (
    <span aria-hidden className={`overflow-hidden ${className}`}>
      {/* The word before stays a moment, on its way out, in the same grid cell. */}
      {shown > 0 ? (
        <span key={shown - 1} className="rotating-word-out whitespace-nowrap [grid-area:1/1]">{words[(shown - 1) % words.length]}</span>
      ) : null}
      <span key={shown} className={`whitespace-nowrap [grid-area:1/1] ${shown > 0 ? "rotating-word-in" : ""}`}>{words[shown % words.length]}</span>
    </span>
  );
}
