import { countSongs, formatDuration } from "@/lib/domain/format";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";

/** How many upcoming singers the room sees; the rest collapse into "+N more". */
const UP_NEXT_ROWS = 4;

/** The queue as the room reads it from the sofa: the next few singers, large, with no controls. */
export function UpNextList({ queue, hasCurrent, queueWait }: { queue: QueueItem[]; hasCurrent: boolean; queueWait: string }) {
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <h2 className="font-display text-[2.5rem] font-bold leading-none tracking-tight">Up next</h2>
        {queue.length > 0 ? (
          <span className="text-[1.5rem] font-medium text-ink-muted">{countSongs(queue.length)} · {queueWait}</span>
        ) : null}
      </div>
      {queue.length === 0 ? (
        <p className="px-1 py-6 text-[1.5rem] font-medium leading-snug text-ink-muted">
          {hasCurrent ? "Nobody is waiting. Scan the code to sing next." : "No songs yet. Scan the code to add the first one."}
        </p>
      ) : (
        <ol className="space-y-2">
          {queue.slice(0, UP_NEXT_ROWS).map((item, index) => (
            <UpNextRow key={item.id} item={item} first={index === 0} />
          ))}
        </ol>
      )}
      {queue.length > UP_NEXT_ROWS ? (
        <p className="mt-3 px-4 text-[1.5rem] font-semibold text-ink-muted">+{queue.length - UP_NEXT_ROWS} more</p>
      ) : null}
    </>
  );
}

function UpNextRow({ item, first }: { item: QueueItem; first: boolean }) {
  const duration = formatDuration(item.durationSeconds);
  return (
    <li className={`flex items-center gap-5 rounded-card p-4 ${first ? "bg-stage-200" : ""}`}>
      <Avatar name={item.addedBy} className="h-16 w-16 text-[1.75rem]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.625rem] font-semibold leading-8">{displayTitle(item.title)}</p>
        <p className="mt-0.5 truncate text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">
          {item.addedBy}{duration ? ` · ${duration}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * Names the next singer over the video near the end of a song. A small card in the top right
 * corner: karaoke videos put their lyrics in the middle and bottom of the picture.
 */
export function UpNextBanner({ item, remainingSeconds }: { item: QueueItem; remainingSeconds: number }) {
  return (
    <div className="animate-rise pointer-events-none absolute right-6 top-6 flex w-max max-w-[30rem] items-center gap-3.5 rounded-card bg-stage-000/90 py-3 pl-3 pr-5 shadow-lift">
      <Avatar name={item.addedBy} className="h-12 w-12 shrink-0 text-[1.375rem]" />
      <div className="min-w-0">
        <p className="text-[1rem] font-bold uppercase leading-5 tracking-[0.1em] text-ink-muted">
          Up next · <span className="tabular-nums">in {formatDuration(remainingSeconds) || "0:00"}</span>
        </p>
        <p className="truncate text-[1.375rem] leading-7">
          <span className="font-bold">{item.addedBy}</span>
          <span className="font-medium text-ink-muted"> · {displayTitle(item.title)}</span>
        </p>
      </div>
    </div>
  );
}
