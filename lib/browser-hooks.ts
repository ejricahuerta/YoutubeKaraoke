"use client";

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** window.location.origin, or "" during server rendering. */
export function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

const CHANGE_EVENT = "karaoke:storage";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode or storage disabled
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore: the app works without persistence
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readStorage(key: string): string | null {
  return typeof window === "undefined" ? null : read(key);
}

/** A localStorage string that re-renders on change. `undefined` until hydrated. */
export function useStoredString(key: string): [string | null | undefined, (value: string | null) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const value = useSyncExternalStore(subscribe, () => read(key), () => undefined);
  const set = useCallback((next: string | null) => writeStorage(key, next), [key]);
  return [value, set];
}
