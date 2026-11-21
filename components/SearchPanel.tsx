"use client";

import { useRef, useState, type FormEvent } from "react";
import { sessionRequest } from "@/lib/useSessionState";
import type { SearchKind, SearchResult } from "@/lib/types";
import { CheckIcon, PlusIcon, SearchIcon } from "./icons";
import { SongRow } from "./SongRow";

const MESSAGES: Record<string, string> = {
  search_unavailable: "YouTube search isn't responding right now. Try again in a moment.",
  rate_limited: "Too many searches. Wait a few seconds and try again.",
  not_found: "This session has ended.",
};

/** Search YouTube for karaoke or lyrics videos and add them to the session queue. */
export function SearchPanel({ code, name, onAdded }: { code: string; name: string; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<SearchKind>("karaoke");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, "adding" | "added">>({});
  const requestId = useRef(0);

  async function runSearch(q: string, k: SearchKind) {
    if (!q.trim()) return;
    const id = ++requestId.current;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/search?code=${code}&kind=${k}&q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;
      if (!res.ok) {
        setResults(null);
        setMessage(MESSAGES[data.error] ?? "Search failed. Try again.");
      } else {
        setResults(data.results ?? []);
        setAdded({});
      }
    } catch {
      if (id === requestId.current) setMessage("You seem to be offline. Check your connection and try again.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query, kind);
  }

  async function add(video: SearchResult) {
    setAdded((a) => ({ ...a, [video.videoId]: "adding" }));
    const status = await sessionRequest(`/api/sessions/${code}/queue`, "POST", { ...video, name });
    if (status === 200) {
      setAdded((a) => ({ ...a, [video.videoId]: "added" }));
      onAdded();
    } else {
      setAdded((a) => Object.fromEntries(Object.entries(a).filter(([id]) => id !== video.videoId)));
      setMessage(
        status === 409 ? "The queue is full. Wait for a few songs to finish."
          : status === 404 || status === 410 ? MESSAGES.not_found
          : "Couldn't add that song. Try again.",
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Song or artist"
            aria-label="Search for a song or artist"
            className="h-12 w-full rounded-full border border-white/10 bg-neutral-900 pl-10 pr-4 text-base text-white placeholder:text-neutral-500 focus:border-rose-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="h-12 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-3 flex gap-2" role="group" aria-label="Video type">
        {(["karaoke", "lyrics"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              runSearch(query, k);
            }}
            className={`h-9 rounded-full px-4 text-sm font-medium capitalize transition ${
              kind === k ? "bg-white text-black" : "bg-white/10 text-neutral-200 hover:bg-white/15"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {message ? <p role="alert" className="mt-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">{message}</p> : null}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {results === null && !message ? (
          <p className="px-2 py-8 text-center text-sm text-neutral-500">
            Search for a song and tap + to add it to the queue.
          </p>
        ) : null}
        {results?.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-neutral-400">No videos found. Try different words.</p>
        ) : null}
        <ul>
          {results?.map((video) => {
            const state = added[video.videoId];
            return (
              <li key={video.videoId}>
                <SongRow
                  thumbnailUrl={video.thumbnailUrl}
                  title={video.title}
                  subtitle={video.channel}
                  durationSeconds={video.durationSeconds}
                  actions={
                    <button
                      type="button"
                      onClick={() => add(video)}
                      disabled={state !== undefined}
                      aria-label={state === "added" ? `Added ${video.title}` : `Add ${video.title} to the queue`}
                      className={`grid h-11 w-11 place-items-center rounded-full transition ${
                        state === "added" ? "bg-emerald-600 text-white" : "bg-white/10 text-white hover:bg-rose-600"
                      } disabled:cursor-default`}
                    >
                      {state === "added" ? <CheckIcon /> : <PlusIcon />}
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
