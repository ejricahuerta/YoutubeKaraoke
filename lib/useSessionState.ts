"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase-browser";
import type { SessionState } from "./types";

const POLL_MS = 15_000;

/**
 * Live state of one karaoke session. The server is the source of truth: we
 * refetch whenever Supabase Realtime pings the session channel, when the tab
 * regains focus, and on a slow poll in case a ping is missed.
 */
export function useSessionState(code: string) {
  const [state, setState] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "archived" | "error">("loading");
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const res = await fetch(`/api/sessions/${code}`, { cache: "no-store" });
      if (request !== latest.current) return; // a newer request superseded this one
      if (res.status === 404) return setStatus("not_found");
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as SessionState;
      setState(next);
      setStatus(next.archived ? "archived" : "ready");
    } catch {
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

    const supabase = supabaseBrowser();
    const channel = supabase
      ?.channel(`session:${code}`)
      .on("broadcast", { event: "changed" }, () => refresh())
      .subscribe();

    return () => {
      clearTimeout(initial);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [code, refresh, ended]);

  return { state, status, refresh };
}

/** POST/PATCH/DELETE helper for session mutations; resolves to the HTTP status. */
export async function sessionRequest(path: string, method: string, body?: unknown): Promise<number> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.status;
  } catch {
    return 0;
  }
}
