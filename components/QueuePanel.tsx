"use client";

import { useState } from "react";
import type { QueueItem } from "@/lib/types";
import { CloseIcon, TopIcon } from "./icons";
import { IconButton, SongRow } from "./SongRow";

/**
 * The "Up next" list. The host can remove any song, send one to the top, and
 * drag to reorder; guests can remove only the songs they added.
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

  if (queue.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-neutral-500">{emptyText}</p>;
  }

  function drop(targetIndex: number) {
    const from = queue.findIndex((q) => q.id === dragId);
    setDragId(null);
    setOverId(null);
    if (!onMove || from < 0 || from === targetIndex) return;
    // Dropping on a row takes that row's place.
    const afterIndex = from < targetIndex ? targetIndex : targetIndex - 1;
    onMove(queue[from].id, afterIndex >= 0 ? queue[afterIndex].id : null);
  }

  return (
    <ol>
      {queue.map((item, index) => (
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
            drop(index);
          }}
          className={`rounded-lg ${isHost ? "cursor-grab active:cursor-grabbing" : ""} ${
            dragId === item.id ? "opacity-40" : ""
          } ${overId === item.id && dragId !== item.id ? "bg-white/10" : ""}`}
        >
          <SongRow
            thumbnailUrl={item.thumbnailUrl}
            title={item.title}
            subtitle={
              <>
                <span className="tabular-nums text-neutral-500">{index + 1}.</span> {item.addedBy}
                {item.mine && !isHost ? " (you)" : ""}
              </>
            }
            durationSeconds={item.durationSeconds}
            className="hover:bg-white/5"
            actions={
              <>
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
            }
          />
        </li>
      ))}
    </ol>
  );
}
