"use client";

import { useRef, useState, type FormEvent } from "react";
import { addSong, searchSongs } from "@/lib/client/session-api";
import { failureMessage } from "@/lib/domain/messages";
import { SINGING_LABEL } from "@/lib/domain/playback";
import { whereInSession } from "@/lib/domain/queue";
import { MAX_WAITING_SONGS } from "@/lib/domain/singers";
import type { QueueItem, SearchKind, SearchResult } from "@/lib/domain/types";
import { CheckIcon, PlusIcon, SearchIcon } from "./Icons";
import { SongRow } from "./SongRow";

/** Search YouTube for karaoke or lyrics videos and add them to the session queue. */
export function SearchPanel({
  code,
  name,
  current,
  queue,
  played,
  onAdded,
}: {
  code: string;
  /** The singer name new songs are added under. */
  name: string;
  /** The session's songs, to mark results that are already playing or queued. */
  current: QueueItem | null;
  queue: QueueItem[];
  played: QueueItem[];
  onAdded: (video: SearchResult) => void;
}) {
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
    const outcome = await searchSongs(code, q, k);
    if (id !== requestId.current) return; // a newer search superseded this one
    setLoading(false);
    if ("results" in outcome) {
      setResults(outcome.results);
      setAdded({});
    } else {
      // Offline keeps the last results on screen; a refusal from the server clears them.
      if (outcome.error !== "network_error") setResults(null);
      setMessage(failureMessage(outcome.error, "Search failed. Try again."));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query, kind);
  }

  async function add(video: SearchResult) {
    setAdded((a) => ({ ...a, [video.videoId]: "adding" }));
    const outcome = await addSong(code, video, name);
    if (outcome === "ok") {
      setAdded((a) => ({ ...a, [video.videoId]: "added" }));
      onAdded(video);
    } else {
      setAdded((a) => Object.fromEntries(Object.entries(a).filter(([id]) => id !== video.videoId)));
      setMessage(failureMessage(outcome, "Couldn't add that song. Try again."));
    }
  }

  /** Where a result already sits in the session, if anywhere. */
  function placement(videoId: string) {
    const found = whereInSession(videoId, current, queue, played);
    if (!found) return null;
    const who = found.mine ? "You" : found.by;
    if (found.place === "singing") return <span className="text-spotlight">{SINGING_LABEL} · {found.by}</span>;
    return <>{found.place === "queued" ? "In queue" : "Sung earlier"} · {who}</>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={onSubmit} className="relative" role="search">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Song or artist"
          aria-label="Search for a song or artist"
          className="h-[3.25rem] w-full rounded-full border-[1.5px] border-line-strong bg-stage-200 pl-[2.875rem] pr-28 text-base font-medium text-ink placeholder:text-ink-faint focus:border-spotlight focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1.5 h-10 rounded-full bg-encore px-5 text-sm font-bold text-on-encore transition hover:bg-encore-hover active:scale-95 disabled:opacity-40"
        >
          {loading ? "Searching" : "Search"}
        </button>
      </form>

      <div className="mt-3 flex items-center gap-3">
        <div className="inline-flex gap-1 rounded-full bg-stage-100 p-1" role="group" aria-label="Video type">
          {(["karaoke", "lyrics"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                runSearch(query, k);
              }}
              className={`h-10 rounded-full px-5 text-sm font-semibold capitalize transition ${
                kind === k ? "bg-ink text-stage-000" : "text-ink-muted hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        {results && results.length > 0 ? (
          <span className="ml-auto text-[0.8125rem] font-semibold text-ink-faint">{results.length} videos</span>
        ) : null}
      </div>

      {queue.filter((item) => item.mine).length >= MAX_WAITING_SONGS && !message ? (
        <p className="mt-3 rounded-row bg-stage-100 px-4 py-3 text-sm font-semibold text-ink-muted">
          You have {MAX_WAITING_SONGS} songs waiting. Add more once one is sung.
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="mt-3 rounded-row bg-notice-ground px-4 py-3 text-sm font-semibold text-notice">{message}</p>
      ) : null}

      <div className="-mx-2 mt-2 min-h-0 flex-1 overflow-y-auto">
        {results === null && !message ? (
          <div className="px-4 py-10 text-center">
            <p className="font-display text-2xl font-bold tracking-tight">What are you singing?</p>
            <p className="mt-2 text-sm text-ink-muted">Search for a song or artist, then tap + to add it to the queue.</p>
          </div>
        ) : null}
        {results?.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">No videos found. Try different words.</p>
        ) : null}
        <ul className="space-y-0.5">
          {results?.map((video) => {
            const state = added[video.videoId];
            const placed = placement(video.videoId);
            return (
              <li key={video.videoId}>
                <SongRow
                  thumbnailUrl={video.thumbnailUrl}
                  title={video.title}
                  subtitle={state === "added" ? <span className="text-aqua">Added to the queue</span> : placed ?? video.channel}
                  durationSeconds={video.durationSeconds}
                  className={state === "added" ? "bg-stage-100" : ""}
                  actions={
                    <button
                      type="button"
                      onClick={() => add(video)}
                      disabled={state !== undefined}
                      aria-label={state === "added" ? `Added ${video.title}` : `Add ${video.title} to the queue`}
                      className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-95 disabled:cursor-default ${
                        state === "added" ? "bg-aqua text-on-aqua" : "bg-stage-200 text-ink hover:bg-encore hover:text-on-encore"
                      }`}
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
