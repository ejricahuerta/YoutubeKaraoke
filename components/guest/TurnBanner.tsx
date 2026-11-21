import type { ReactNode } from "react";
import { ordinal } from "@/lib/domain/format";
import { SINGING_LABEL } from "@/lib/domain/playback";
import type { QueuedSong } from "@/lib/domain/queue";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";

/** The spotlight card shown only when this guest is singing now or next; nothing otherwise. */
export function TurnBanner({ onNow, next, hasCurrent }: { onNow: QueueItem | null; next: QueuedSong | undefined; hasCurrent: boolean }) {
  if (onNow) {
    return <Spotlight overline={SINGING_LABEL} title={<>You&apos;re on.<br />Go sing.</>} song={displayTitle(onNow.title)} />;
  }
  if (next?.index === 0) {
    return (
      <Spotlight
        overline={hasCurrent ? "Starts after this song" : "Starting now"}
        title={<>You&apos;re next.<br />Head to the mic.</>}
        song={displayTitle(next.item.title)}
      />
    );
  }
  return null;
}

/** Whether TurnBanner has something to show. */
export function isTurnSoon(onNow: QueueItem | null, next: QueuedSong | undefined): boolean {
  return onNow !== null || next?.index === 0;
}

function Spotlight({ overline, title, song }: { overline: string; title: ReactNode; song: string }) {
  return (
    <div className="animate-rise mb-3 rounded-card bg-spotlight px-5 pb-5 pt-6 text-on-spotlight">
      <p className="text-xs font-bold uppercase tracking-[0.1em]">{overline}</p>
      <p className="mt-3 font-display text-[3.25rem] font-extrabold leading-[0.95] tracking-tight">{title}</p>
      <p className="mt-3.5 text-lg font-bold leading-6">{song}</p>
    </div>
  );
}

/** A guest's place in line when their turn is not next yet. */
export function NextSongCard({ next, wait }: { next: QueuedSong; wait: string }) {
  return (
    <div className="mb-3 rounded-card bg-stage-100 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your next song</p>
      <p className="mt-2 flex items-baseline gap-2.5">
        <span className="font-display text-[2.5rem] font-extrabold leading-none tracking-tight">{ordinal(next.index + 1)}</span>
        <span className="text-base font-semibold text-ink-muted">in line, {wait}</span>
      </p>
      <p className="mt-2 truncate text-base font-semibold">{displayTitle(next.item.title)}</p>
    </div>
  );
}
