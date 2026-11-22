import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";
import { IconButton } from "../IconButton";
import { PlusIcon } from "../Icons";
import { SongRow } from "../SongRow";

/** Songs already sung tonight, newest first, each with a way to add it to the queue again. */
export function SungTonight({ played, onSingAgain }: { played: QueueItem[]; onSingAgain: (item: QueueItem) => void }) {
  if (played.length === 0) return null;
  return (
    <section aria-labelledby="sung-tonight" className="mt-5">
      <h2 id="sung-tonight" className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
        Sung tonight
      </h2>
      <ol className="-mx-2 space-y-0.5">
        {played.map((item) => (
          <li key={item.id}>
            <SongRow
              leading={<Avatar name={item.addedBy} />}
              title={displayTitle(item.title)}
              subtitle={item.mine ? <span className="text-ink">You</span> : item.addedBy}
              className="pl-3"
              actions={
                <IconButton label={`Sing ${item.title} again`} onClick={() => onSingAgain(item)}>
                  <PlusIcon />
                </IconButton>
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
