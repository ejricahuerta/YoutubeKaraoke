import { ordinal } from "@/lib/domain/format";
import type { QueuedSong } from "@/lib/domain/queue";
import { CheckIcon } from "../Icons";

/** Confirms an add and says where it landed, with an undo while it is still queued. */
export function AddedToast({
  placed,
  onNow,
  wait,
  onUndo,
}: {
  /** The added song in the queue, if it is still waiting. */
  placed: QueuedSong | undefined;
  /** The added song is already the one playing. */
  onNow: boolean;
  wait: (index: number) => string;
  onUndo: (itemId: string) => void;
}) {
  return (
    <div role="status" className="animate-rise mx-4 mb-2 flex items-center gap-3 rounded-full bg-ink py-2 pl-2.5 pr-3 text-sm font-semibold text-stage-000 shadow-lift">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aqua text-on-aqua"><CheckIcon className="h-[1.125rem] w-[1.125rem]" /></span>
      <span className="min-w-0 flex-1">
        {placed
          ? `Added. You're ${ordinal(placed.index + 1)}, ${wait(placed.index)}.`
          : onNow ? "Added. You're on now." : "Added."}
      </span>
      {placed ? (
        <button type="button" onClick={() => onUndo(placed.item.id)} className="h-11 shrink-0 px-2 font-bold underline">
          Undo
        </button>
      ) : null}
    </div>
  );
}
