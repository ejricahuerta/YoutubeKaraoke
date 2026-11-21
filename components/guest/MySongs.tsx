import { ordinal } from "@/lib/domain/format";
import { SINGING_LABEL } from "@/lib/domain/playback";
import type { QueuedSong } from "@/lib/domain/queue";
import type { QueueItem } from "@/lib/domain/types";
import { IconButton } from "../IconButton";
import { CloseIcon, PlusIcon } from "../Icons";
import { SongRow } from "../SongRow";

/** The "My songs" tab: this guest's songs with their place in line, and a way to add more. */
export function MySongs({
  onNow,
  queued,
  wait,
  onRemove,
  onFindSong,
}: {
  onNow: QueueItem | null;
  queued: QueuedSong[];
  wait: (index: number) => string;
  onRemove: (itemId: string) => void;
  onFindSong: () => void;
}) {
  const hasSongs = onNow !== null || queued.length > 0;
  return (
    <>
      {hasSongs ? (
        <section>
          <h2 className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your songs tonight</h2>
          <ul className="-mx-2 space-y-0.5">
            {onNow ? (
              <li>
                <SongRow
                  thumbnailUrl={onNow.thumbnailUrl}
                  title={onNow.title}
                  subtitle={<span className="text-spotlight">{SINGING_LABEL}</span>}
                  durationSeconds={onNow.durationSeconds}
                  className="bg-stage-100"
                />
              </li>
            ) : null}
            {queued.map(({ item, index }) => (
              <li key={item.id}>
                <SongRow
                  thumbnailUrl={item.thumbnailUrl}
                  title={item.title}
                  subtitle={index === 0 ? <span className="text-spotlight">Up next</span> : `${ordinal(index + 1)} in line, ${wait(index)}`}
                  durationSeconds={item.durationSeconds}
                  className={index === 0 ? "bg-stage-100" : ""}
                  actions={
                    <IconButton label={`Remove ${item.title}`} onClick={() => onRemove(item.id)}>
                      <CloseIcon />
                    </IconButton>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="px-4 py-10 text-center">
          <p className="font-display text-2xl font-bold tracking-tight">No songs yet</p>
          <p className="mt-2 text-sm text-ink-muted">Songs you add show up here with your place in line.</p>
        </div>
      )}
      <button
        type="button"
        onClick={onFindSong}
        className="flex h-[3.25rem] items-center justify-center gap-2.5 rounded-full bg-stage-200 text-base font-semibold transition hover:bg-stage-300 active:scale-[0.98]"
      >
        <PlusIcon /> {hasSongs ? "Add another song" : "Find a song"}
      </button>
    </>
  );
}
