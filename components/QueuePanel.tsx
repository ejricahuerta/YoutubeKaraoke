"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/domain/format";
import { dropAfterId } from "@/lib/domain/queue";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";
import { CloseIcon, MoveIcon, TopIcon } from "./Icons";
import { SongRow } from "./SongRow";

/**
 * The full "Up next" list. The host can remove any song, send one to the top, and
 * reorder; guests can remove only the songs they added.
 *
 * Reordering works two ways. Dragging, for a mouse. And "Move", for touch screens, keyboards
 * and TV remotes, where dragging does not work: press Move on a song, then press where it goes.
 */
export function QueuePanel({
  queue,
  isHost,
  onRemove,
  onMove,
  emptyText,
}: {
  queue: QueueItem[];
  isHost: boolean;
  onRemove: (id: string) => void;
  onMove?: (id: string, afterId: string | null) => void;
  emptyText: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // The picked song may be played or removed by someone else while the host decides where it goes.
  const movingId = pickedId !== null && queue.some((item) => item.id === pickedId) ? pickedId : null;

  useEffect(() => {
    if (!movingId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movingId]);

  if (queue.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-ink-faint">{emptyText}</p>;
  }

  /** Puts the dragged or picked song in the place of the row at `targetIndex`. */
  function drop(sourceId: string | null, targetIndex: number) {
    const afterId = dropAfterId(queue, sourceId, targetIndex);
    if (onMove && sourceId && afterId !== undefined) onMove(sourceId, afterId);
    setDragId(null);
    setOverId(null);
    setPickedId(null);
  }

  return (
    <ol className="space-y-0.5">
      {queue.map((item, index) => {
        const mine = item.mine && !isHost;
        const duration = formatDuration(item.durationSeconds);
        return (
          <li
            key={item.id}
            draggable={isHost}
            onDragStart={(e) => {
              setDragId(item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(item.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(dragId, index);
            }}
            className={`rounded-row ${isHost ? "cursor-grab active:cursor-grabbing" : ""} ${
              dragId === item.id ? "opacity-40" : ""
            } ${(overId === item.id && dragId !== item.id) || movingId === item.id ? "bg-stage-300" : ""}`}
          >
            <SongRow
              leading={<Avatar name={item.addedBy} />}
              title={displayTitle(item.title)}
              subtitle={
                <>
                  <span className="tabular-nums">{index + 1}</span> ·{" "}
                  {mine ? <span className="text-ink">You</span> : item.addedBy}
                  {duration ? ` · ${duration}` : ""}
                </>
              }
              className={`pl-3 ${mine ? "bg-stage-100" : isHost ? "hover:bg-stage-200" : ""}`}
              actions={
                movingId === item.id ? (
                  <IconButton label="Cancel move" onClick={() => setPickedId(null)}>
                    <CloseIcon />
                  </IconButton>
                ) : movingId ? (
                  <button
                    type="button"
                    onClick={() => drop(movingId, index)}
                    aria-label={`Move here, to place ${index + 1}`}
                    className="h-11 rounded-full bg-encore px-4 text-sm font-bold text-on-encore transition hover:bg-encore-hover active:scale-95"
                  >
                    Here
                  </button>
                ) : (
                  <>
                    {isHost && onMove && queue.length > 1 ? (
                      <IconButton label={`Move ${item.title}`} onClick={() => setPickedId(item.id)}>
                        <MoveIcon />
                      </IconButton>
                    ) : null}
                    {isHost && onMove && index > 0 ? (
                      <IconButton label={`Play ${item.title} next`} onClick={() => onMove(item.id, null)}>
                        <TopIcon />
                      </IconButton>
                    ) : null}
                    {isHost || item.mine ? (
                      <IconButton label={`Remove ${item.title}`} onClick={() => onRemove(item.id)}>
                        <CloseIcon />
                      </IconButton>
                    ) : null}
                  </>
                )
              }
            />
          </li>
        );
      })}
    </ol>
  );
}
