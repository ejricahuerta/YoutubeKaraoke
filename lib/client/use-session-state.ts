"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { failureMessage, isFailure } from "@/lib/domain/messages";
import type { SessionState } from "@/lib/domain/types";
import { moveSong, removeSong, sessionStateUrl, type MutationOutcome } from "./session-api";
import { getSupabaseBrowserClient } from "./supabase";

const POLL_MS = 15_000;
/** Refetches that must fail in a row before a screen says it is reconnecting: one blip is not worth a notice. */
const STALE_AFTER_FAILURES = 2;
/** Must match karaoke.notify() in supabase/migrations: channel "session:CODE", event "changed". */
const CHANGED_EVENT = "changed";
const channelName = (code: string) => `session:${code}`;

export type SessionStatus = "loading" | "ready" | "not_found" | "archived" | "error";

/**
 * Live state of one karaoke session. The server is the source of truth: we
 * refetch whenever Supabase Realtime pings the session channel, when the tab
 * regains focus, and on a slow poll in case a ping is missed (docs/adr/0003).
 *
 * `onActionFailed` is told, in words for the person, when a queue change did not happen.
 */
export function useSessionState(code: string, onActionFailed?: (message: string) => void) {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [failures, setFailures] = useState(0);
  const latest = useRef(0);
  const reportFailure = useRef(onActionFailed);
  useEffect(() => {
    reportFailure.current = onActionFailed;
  });

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const res = await fetch(sessionStateUrl(code), { cache: "no-store" });
      if (request !== latest.current) return; // a newer request superseded this one
      if (res.status === 404) return setStatus("not_found");
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as SessionState;
      // A database without migrations 0005 and 0007 leaves these out: nothing sung yet, nothing to warn about.
      const next = {
        ...body,
        played: body.played ?? [],
        isRemote: body.isRemote ?? false,
        takeTurns: body.takeTurns ?? true,
        hostAwaySeconds: body.hostAwaySeconds ?? null,
        closesInSeconds: body.closesInSeconds ?? null,
      };
      setFailures(0);
      setState(next);
      setStatus(next.archived ? "archived" : "ready");
    } catch {
      // Keep showing the last good state through a blip; only a first load can fail visibly.
      if (request !== latest.current) return;
      setFailures((n) => n + 1);
      setStatus((s) => (s === "ready" ? "ready" : "error"));
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
  const actions = useMemo(() => {
    const finish = (outcome: MutationOutcome, fallback: string) => {
      if (isFailure(outcome)) reportFailure.current?.(failureMessage(outcome, fallback));
      refresh();
    };
    return {
      remove: async (itemId: string) => finish(await removeSong(code, itemId), "Couldn't remove that song. Try again."),
      move: async (itemId: string, afterId: string | null) =>
        finish(await moveSong(code, itemId, afterId), "Couldn't move that song. Try again."),
    };
  }, [code, refresh]);

  /** True while the last good state is still showing but refetches keep failing. */
  const reconnecting = status === "ready" && failures >= STALE_AFTER_FAILURES;

  return { state, status, reconnecting, refresh, ...actions };
}
