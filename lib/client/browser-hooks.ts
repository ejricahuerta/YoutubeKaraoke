"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** window.location.origin, or "" during server rendering. */
export function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Whether any element is in full screen. */
export function useFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement !== null, () => false);
}

/** State that clears itself after `ms`: for toasts and notices. */
export function useExpiringState<T>(ms: number): [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    const timer = setTimeout(() => setValue(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return [value, setValue];
}

/** Every localStorage key the app uses. All are per browser, none are needed for the app to work. */
export const STORAGE_KEYS = {
  /** Guest's singer name. */
  name: "karaoke:name",
  /** Main screen volume, 0-100. */
  volume: "karaoke:volume",
  /** "1" when the main screen's queue panel is hidden. */
  queueHidden: "karaoke:queue-hidden",
  /** JSON { itemId, seconds }: where the main screen was in the current song. */
  position: "karaoke:position",
} as const;
type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const CHANGE_EVENT = "karaoke:storage";

function read(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode or storage disabled
  }
}

export function writeStorage(key: StorageKey, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore: the app works without persistence
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readStorage(key: StorageKey): string | null {
  return typeof window === "undefined" ? null : read(key);
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A localStorage string that re-renders on change. `undefined` until hydrated. */
export function useStoredString(key: StorageKey): [string | null | undefined, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribeStorage, () => read(key), () => undefined);
  const set = useCallback((next: string | null) => writeStorage(key, next), [key]);
  return [value, set];
}
