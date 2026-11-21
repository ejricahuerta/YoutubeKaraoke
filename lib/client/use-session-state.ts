"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionState } from "@/lib/domain/types";
import { moveSong, removeSong, sessionStateUrl } from "./session-api";
import { getSupabaseBrowserClient } from "./supabase";

const POLL_MS = 15_000;
/** Must match karaoke.notify() in supabase/migrations: channel "session:CODE", event "changed". */
const CHANGED_EVENT = "changed";
const channelName = (code: string) => `session:${code}`;

export type SessionStatus = "loading" | "ready" | "not_found" | "archived" | "error";

/**
 * Live state of one karaoke session. The server is the source of truth: we
 * refetch whenever Supabase Realtime pings the session channel, when the tab
 * regains focus, and on a slow poll in case a ping is missed (docs/adr/0003).
 */
export function useSessionState(code: string) {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const res = await fetch(sessionStateUrl(code), { cache: "no-store" });
      if (request !== latest.current) return; // a newer request superseded this one
      if (res.status === 404) return setStatus("not_found");
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as SessionState;
      setState(next);
      setStatus(next.archived ? "archived" : "ready");
    } catch {
      // Keep showing the last good state through a blip; only a first load can fail visibly.
      if (request === latest.current) setStatus((s) => (s === "ready" ? "ready" : "error"));
    }
  }, [code]);

  const ended = status === "archived" || status === "not_found";

  useEffect(() => {
    if (ended) return; // the session is over: stop polling and listening
    const initial = setTimeout(refresh, 0);
    const poll = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(channelName(code))
      .on("broadcast", { event: CHANGED_EVENT }, () => refresh())
      .subscribe();

    return () => {
      clearTimeout(initial);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [code, refresh, ended]);

  // Queue changes any screen may make; each refetches at once rather than waiting for the ping.
  const actions = useMemo(
    () => ({
      remove: async (itemId: string) => {
        await removeSong(code, itemId);
        refresh();
      },
      move: async (itemId: string, afterId: string | null) => {
        await moveSong(code, itemId, afterId);
        refresh();
      },
    }),
    [code, refresh],
  );

  return { state, status, refresh, ...actions };
}
