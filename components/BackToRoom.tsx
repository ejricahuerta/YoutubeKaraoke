"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/client/browser-hooks";
import { isRoomLive } from "@/lib/client/use-room";

/**
 * On the start page: a browser that is in a room still going goes straight back to it,
 * so a new tab opens where the guest already is. One that has ended is forgotten.
 */
export function BackToRoom() {
  const router = useRouter();
  useEffect(() => {
    const room = readStorage(STORAGE_KEYS.room);
    if (!room) return;
    let cancelled = false;
    isRoomLive(room).then((live) => {
      if (cancelled) return;
      if (live) router.replace(`/join/${room}`);
      else writeStorage(STORAGE_KEYS.room, null);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
