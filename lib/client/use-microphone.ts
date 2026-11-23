"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MIC_SETTINGS,
  MIC_TEST_TIMEOUT_MS,
  micConstraints,
  micStatusFromError,
  parseMicSettings,
  serializeMicSettings,
  type MicSettings,
  type MicStatus,
} from "@/lib/domain/microphone";
import { STORAGE_KEYS, useStoredString } from "./browser-hooks";
import { listMicDevices, openMicGraph, type MicDevice, type MicGraph } from "./microphone-graph";

export type Microphone = {
  settings: MicSettings;
  change: (patch: Partial<MicSettings>) => void;
  /** Back to the default sound; the mic stays on or off and on the same device. */
  resetSound: () => void;
  status: MicStatus;
  devices: MicDevice[];
  /** Test mic: the voice is live for a short while even with the mic off. */
  isTesting: boolean;
  setTesting: (on: boolean) => void;
  /** Tries again after a refusal or a missing mic. */
  retry: () => void;
  /** The voice's level now, 0-1; 0 when nothing is live. */
  readLevel: () => number;
  /** The delay the browser reports, in ms; null when nothing is live or it reports none. */
  readDelayMs: () => number | null;
  /** The name of the mic in use; "" when none is open. */
  activeLabel: string;
  /** Times the whole delay with beeps through the speakers; one value per beep heard, in ms. */
  measureDelay: () => Promise<number[]>;
};

/**
 * The main screen's microphone (docs/adr/0024). Settings are kept per browser; the voice goes
 * to the speakers while the mic is on or being tested, and only where `canUse` (the host).
 */
export function useMicrophone(canUse: boolean): Microphone {
  const [stored, setStored] = useStoredString(STORAGE_KEYS.microphone);
  const settings = useMemo(() => parseMicSettings(stored), [stored]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  const change = useCallback(
    (patch: Partial<MicSettings>) => setStored(serializeMicSettings({ ...settingsRef.current, ...patch })),
    [setStored],
  );
  const resetSound = useCallback(() => {
    const { isEnabled, deviceId } = settingsRef.current;
    setStored(serializeMicSettings({ ...DEFAULT_MIC_SETTINGS, isEnabled, deviceId }));
  }, [setStored]);

  const [isTesting, setTesting] = useState(false);
  useEffect(() => {
    if (!isTesting) return;
    const timer = setTimeout(() => setTesting(false), MIC_TEST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isTesting]);

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // A new device or clean-up switch means opening the mic again; the sliders do not.
  const isRunning = canUse && (settings.isEnabled || isTesting);
  const openKey = `${JSON.stringify(micConstraints(settings))}#${attempt}`;
  // The outcome of the latest open, tagged with the key it was for, so a stale one is ignored.
  const [opened, setOpened] = useState<{ key: string; status: MicStatus; label: string } | null>(null);
  const graphRef = useRef<MicGraph | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    let graph: MicGraph | null = null;
    const showState = () =>
      !cancelled && graph && setOpened({ key: openKey, status: graph.state() === "running" ? "live" : "needs-tap", label: graph.label });
    openMicGraph(settingsRef.current).then(
      (next) => {
        if (cancelled) return next.close();
        graph = next;
        graphRef.current = next;
        next.update(settingsRef.current);
        next.onStateChange(showState);
        showState();
      },
      (error: unknown) => {
        if (!cancelled) setOpened({ key: openKey, status: micStatusFromError((error as { name?: string } | null)?.name ?? ""), label: "" });
      },
    );
    return () => {
      cancelled = true;
      graph?.close();
      if (graphRef.current === graph) graphRef.current = null;
    };
  }, [isRunning, openKey]);

  useEffect(() => {
    graphRef.current?.update(settings);
  }, [settings]);

  const isCurrent = isRunning && opened?.key === openKey;
  const status: MicStatus = !isRunning ? "off" : isCurrent ? opened.status : "starting";
  const activeLabel = isCurrent ? opened.label : "";

  // A reload with the mic on opens it before anyone has pressed anything, which browsers
  // keep silent: the next press anywhere lets it play.
  useEffect(() => {
    if (status !== "needs-tap") return;
    const wake = () => graphRef.current?.resume().catch(() => {});
    document.addEventListener("pointerdown", wake);
    document.addEventListener("keydown", wake);
    return () => {
      document.removeEventListener("pointerdown", wake);
      document.removeEventListener("keydown", wake);
    };
  }, [status]);

  // The list of mics, again once the mic is allowed (that is when they get names) and when one is plugged in.
  const [devices, setDevices] = useState<MicDevice[]>([]);
  useEffect(() => {
    if (!canUse) return;
    let cancelled = false;
    const refresh = () => listMicDevices().then((next) => !cancelled && setDevices(next));
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, [canUse, status]);

  const readLevel = useCallback(() => graphRef.current?.readLevel() ?? 0, []);
  const readDelayMs = useCallback(() => graphRef.current?.readDelayMs() ?? null, []);
  const measureDelay = useCallback(() => graphRef.current?.measureDelay() ?? Promise.resolve([]), []);

  return { settings, change, resetSound, status, devices, isTesting, setTesting, retry, readLevel, readDelayMs, activeLabel, measureDelay };
}
