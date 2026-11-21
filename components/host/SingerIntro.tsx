"use client";

import { useEffect, useState } from "react";
import { INTRO_SECONDS } from "@/lib/domain/playback";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";
import { PlayIcon } from "../Icons";
import { OVERLINE } from "./styles";

/** How many singers after this one the intro names. */
const THEN_SINGERS = 3;
const RING_RADIUS = 150;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** "Leo, you're up!": a short countdown before each song so the singer can reach the mic. */
export function SingerIntro({
  item,
  then,
  onStart,
  onSkip,
}: {
  item: QueueItem;
  /** The queue after this song. */
  then: QueueItem[];
  onStart: () => void;
  onSkip: () => void;
}) {
  const [left, setLeft] = useState(INTRO_SECONDS);
  useEffect(() => {
    const timer = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onStart();
  }, [left, onStart]);

  return (
    <div className="flex h-full flex-col justify-center gap-10 bg-stage-000 px-14 py-10">
      <div className="flex items-center gap-14">
        <div className="relative h-[17.5rem] w-[17.5rem] shrink-0">
          <svg viewBox="0 0 320 320" aria-hidden className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="160" cy="160" r={RING_RADIUS} fill="none" strokeWidth="12" className="stroke-stage-300" />
            <circle
              cx="160" cy="160" r={RING_RADIUS} fill="none" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.max(0, left) / INTRO_SECONDS)}
              className="stroke-spotlight transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <Avatar name={item.addedBy} className="absolute inset-[2.25rem] font-display text-[7rem] font-extrabold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`${OVERLINE} text-spotlight`} role="timer">Up next · starts in {Math.max(0, left)}</p>
          <h1 className="mt-5 font-display text-[7rem] font-extrabold leading-[0.92] tracking-[-0.03em] [overflow-wrap:anywhere]">
            {item.addedBy},<br />you&apos;re up!
          </h1>
          <p className="mt-6 line-clamp-2 font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-ink-muted">{displayTitle(item.title)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="flex h-20 items-center gap-4 rounded-full bg-ink pl-8 pr-10 text-[1.75rem] font-bold text-stage-000 transition hover:scale-[1.03] active:scale-[0.97]"
          >
            <PlayIcon className="h-9 w-9" /> Start now
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-20 max-w-[22rem] truncate rounded-full bg-stage-200 px-9 text-[1.75rem] font-semibold transition hover:bg-stage-300 active:scale-[0.97]"
          >
            Skip {item.addedBy}
          </button>
        </div>
        {then.length > 0 ? (
          <div className="flex min-w-0 items-center gap-4 text-[1.625rem] font-semibold">
            <span className={`${OVERLINE} text-ink-muted`}>Then</span>
            {then.slice(0, THEN_SINGERS).map((q) => (
              <span key={q.id} className="flex min-w-0 items-center gap-3">
                <Avatar name={q.addedBy} className="h-12 w-12 text-[1.375rem]" />
                <span className="truncate">{q.addedBy}</span>
              </span>
            ))}
            {then.length > THEN_SINGERS ? <span className="shrink-0 font-medium text-ink-muted">+{then.length - THEN_SINGERS} more</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
