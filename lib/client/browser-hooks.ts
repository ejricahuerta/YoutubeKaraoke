"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

/**
 * Keeps the screen from dimming or sleeping while `enabled`, where the browser can.
 * The host screen needs this: a sleeping laptop stops polling and its session is archived (docs/adr/0008).
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) next.release();
        else lock = next;
      } catch {
        // Refused (low battery, tab not visible): the screen just behaves as it always did.
      }
    };
    // The browser drops the lock whenever the tab is hidden, so take it again on return.
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

const TURN_VIBRATION_MS = [200, 100, 200];

/**
 * Gets a guest's attention when `alertKey` changes to a new value: the phone vibrates where
 * it can, and a tab in the background shows `title` until it is looked at. The value present
 * when the page opens is not alerted: the person is already looking at it.
 */
export function useTurnAlert(alertKey: string | null, title: string) {
  const last = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const previous = last.current;
    last.current = alertKey;
    if (previous === undefined || alertKey === null || alertKey === previous) return;
    try {
      navigator.vibrate?.(TURN_VIBRATION_MS);
    } catch {
      // Not allowed before the first tap on some browsers; the banner on screen still shows.
    }
    if (document.visibilityState === "visible") return;
    const original = document.title;
    document.title = title;
    const restore = () => {
      if (document.visibilityState !== "visible") return;
      document.title = original;
      document.removeEventListener("visibilitychange", restore);
    };
    document.addEventListener("visibilitychange", restore);
  }, [alertKey, title]);
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
  /** Code of the room this browser is in as a guest: every tab follows it (lib/client/use-room). */
  room: "karaoke:room",
  /** Main screen volume, 0-100. */
  volume: "karaoke:volume",
  /** "1" when the main screen's queue panel is hidden. */
  queueHidden: "karaoke:queue-hidden",
  /** JSON { itemId, seconds }: where the main screen was in the current song. */
  position: "karaoke:position",
  /** JSON MicSettings (lib/domain/microphone): the main screen's mic, echo and reverb. */
  microphone: "karaoke:microphone",
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
