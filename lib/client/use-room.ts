"use client";

/**
 * One browser, one room. A guest's browser remembers the room it is in (localStorage, so
 * every tab shares it and hears when it changes). A tab opened on another room's link
 * asks before moving the browser; a room that has ended lets go. See docs/adr/0017.
 */
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS, useStoredString } from "./browser-hooks";
import { sessionStateUrl } from "./session-api";

/** Whether a session can still be joined; unknown (network trouble) counts as live, to be safe. */
export async function isRoomLive(code: string): Promise<boolean> {
  try {
    const res = await fetch(sessionStateUrl(code), { cache: "no-store" });
    if (res.status === 404) return false;
    const state = await res.json().catch(() => null);
    return !state?.archived;
  } catch {
    return true;
  }
}

export type RoomStatus =
  | { kind: "checking" }
  | { kind: "here" }
  /** This browser is in another room that is still going. */
  | { kind: "elsewhere"; room: string };

/** Which room this tab may show for `code`, and how to move the browser here or out. */
export function useRoom(code: string) {
  const [room, setRoom] = useStoredString(STORAGE_KEYS.room);
  // Rooms found to be live or over, so each is checked once.
  const [live, setLive] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    if (room === undefined || room === code) return;
    // No room yet, or one that is over: this tab's room becomes the browser's, unless it is the one that is over.
    if (room === null || room === over) {
      if (over !== code) setRoom(code);
      return;
    }
    if (room === live) return;
    let cancelled = false;
    isRoomLive(room).then((isLive) => {
      if (!cancelled) (isLive ? setLive : setOver)(room);
    });
    return () => {
      cancelled = true;
    };
  }, [room, code, live, over, setRoom]);

  const status: RoomStatus =
    room === code || over === code ? { kind: "here" } : room && room === live ? { kind: "elsewhere", room } : { kind: "checking" };

  return {
    status,
    /** Moves this browser, and so every tab, to this tab's room. */
    switchHere: useCallback(() => {
      setOver(null);
      setRoom(code);
    }, [code, setRoom]),
    /** Forgets the room, so the start page stops sending this browser back to it. */
    leave: useCallback(() => setRoom(null), [setRoom]),
    /** This tab's room has ended: let the browser go, without claiming it again. */
    ended: useCallback(() => {
      setOver(code);
      if (room === code) setRoom(null);
    }, [code, room, setRoom]),
  };
}
