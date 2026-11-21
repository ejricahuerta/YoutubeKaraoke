"use client";

import { useEffect, useRef } from "react";
import { hostKeyCommand, type HostKeyCommand } from "@/lib/domain/playback";

/** Runs `onCommand` for remote and keyboard keys while `enabled` (see hostKeyCommand for the mapping). */
export function useHostKeys(enabled: boolean, onCommand: (command: HostKeyCommand) => void) {
  const handler = useRef(onCommand);
  useEffect(() => {
    handler.current = onCommand;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const command = hostKeyCommand(e.key, !!target?.closest("input, button, a, textarea, select"));
      if (!command) return;
      if (command === "toggle") e.preventDefault(); // Space would scroll the page
      handler.current(command);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
