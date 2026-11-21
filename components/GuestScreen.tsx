"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useStoredString } from "@/lib/browser-hooks";
import { displayTitle } from "@/lib/format";
import { countSongs, formatWait, ordinal, waitSeconds } from "@/lib/singers";
import type { QueueItem, SearchResult } from "@/lib/types";
import { sessionRequest, useSessionState } from "@/lib/useSessionState";
import { Avatar } from "./Avatar";
import { Credit } from "./Credit";
import { CenteredMessage } from "./HostScreen";
import { CheckIcon, CloseIcon, MicIcon, PlusIcon, QueueIcon, SearchIcon } from "./icons";
import { Logo } from "./Logo";
import { QueuePanel } from "./QueuePanel";
import { SearchPanel } from "./SearchPanel";
import { IconButton, SongRow } from "./SongRow";

type Tab = "search" | "queue" | "mine";
const TAB_TITLES: Record<Tab, string> = { search: "Find a song", queue: "Queue", mine: "My songs" };

export function GuestScreen({ code }: { code: string }) {
  const { state, status, refresh } = useSessionState(code);
  const [name, setName] = useStoredString("karaoke:name");
  const [draftName, setDraftName] = useState("");
  const [tab, setTab] = useState<Tab>("search");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(null), 6000);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const remove = useCallback(
    async (id: string) => {
      await sessionRequest(`/api/sessions/${code}/queue/${id}`, "DELETE");
      refresh();
    },
    [code, refresh],
  );

  const onAdded = useCallback(
    (video: SearchResult) => {
      setJustAdded(video.videoId);
      refresh();
    },
    [refresh],
  );

  if (status === "archived") {
    return (
      <CenteredMessage title="This session has ended">
        Ask the host to start a new one, then scan its QR code.
      </CenteredMessage>
    );
  }
  if (status === "not_found") {
    return (
      <CenteredMessage title="Session not found">
        This karaoke session has ended, or the code is wrong. Scan the QR code on the screen again, or{" "}
        <Link href="/" className="font-semibold text-encore underline">go to the start page</Link>.
      </CenteredMessage>
    );
  }
  if (!state || name === undefined) {
    return (
      <CenteredMessage title={status === "error" ? "Can't reach the server" : "Loading…"}>
        {status === "error" ? "Check your connection. This page will keep retrying." : null}
      </CenteredMessage>
    );
  }

  if (!name) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (draftName.trim()) setName(draftName.trim().slice(0, 40));
    };
    return (
      <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-stage-200 px-3 py-2 font-mono text-base tracking-[0.14em]">{code}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-6">
          <Avatar name={draftName} className="h-24 w-24 font-display text-5xl font-extrabold transition-colors" />
          <div>
            <h1 className="font-display text-[2.5rem] font-extrabold leading-none tracking-tight">What should we call you?</h1>
            <p className="mt-2 text-base text-ink-muted">Your name shows on the big screen when it&apos;s your turn.</p>
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-ink-muted">Your name</label>
            <input
              id="name"
              autoFocus
              autoComplete="given-name"
              maxLength={40}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="mt-2 h-14 w-full rounded-row border-2 border-line-strong bg-stage-200 px-5 text-xl font-semibold text-ink focus:border-spotlight focus:outline-none"
            />
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={!draftName.trim()}
            className="h-14 w-full rounded-full bg-encore text-lg font-bold text-on-encore transition hover:bg-encore-hover active:scale-[0.98] disabled:opacity-40"
          >
            Join and pick a song
          </button>
          <Credit className="mt-4 text-center" />
        </div>
      </form>
    );
  }

  const { current, queue } = state;
  const mineQueued = queue.map((item, index) => ({ item, index })).filter(({ item }) => item.mine);
  const onNow = current?.mine ? current : null;
  const next = mineQueued[0];
  const myCount = mineQueued.length + (onNow ? 1 : 0);
  const waitFor = (index: number) => formatWait(waitSeconds(current, queue, index));

  // What the "added" toast says about the song that was just added.
  let toast: ReactNode = null;
  if (justAdded) {
    const placed = mineQueued.findLast(({ item }) => item.videoId === justAdded);
    toast = (
      <div role="status" className="animate-rise mx-4 mb-2 flex items-center gap-3 rounded-full bg-ink py-2 pl-2.5 pr-3 text-sm font-semibold text-stage-000 shadow-lift">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aqua text-on-aqua"><CheckIcon className="h-[1.125rem] w-[1.125rem]" /></span>
        <span className="min-w-0 flex-1">
          {placed
            ? `Added. You're ${ordinal(placed.index + 1)}, ${waitFor(placed.index)}.`
            : onNow?.videoId === justAdded ? "Added. You're on now." : "Added."}
        </span>
        {placed ? (
          <button
            type="button"
            onClick={() => {
              setJustAdded(null);
              remove(placed.item.id);
            }}
            className="h-11 shrink-0 px-2 font-bold underline"
          >
            Undo
          </button>
        ) : null}
      </div>
    );
  }

  const myTurn = onNow ? (
    <TurnBanner overline="Now singing" title={<>You&apos;re on.<br />Go sing.</>} song={displayTitle(onNow.title)} />
  ) : next?.index === 0 ? (
    <TurnBanner
      overline={current ? "Starts after this song" : "Starting now"}
      title={<>You&apos;re next.<br />Head to the mic.</>}
      song={displayTitle(next.item.title)}
    />
  ) : null;

  const tabs: [Tab, string, ReactNode][] = [
    ["search", "Search", <SearchIcon key="i" />],
    ["queue", `Queue · ${queue.length}`, <QueueIcon key="i" />],
    ["mine", `My songs · ${myCount}`, <MicIcon key="i" className="h-5 w-5" />],
  ];

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo label={TAB_TITLES[tab]} />
        <button
          type="button"
          onClick={() => setName(null)}
          aria-label={`${name}, change name`}
          className="ml-auto flex h-11 max-w-[45%] shrink-0 items-center gap-2 rounded-full bg-stage-200 pl-1.5 pr-3.5 text-sm font-semibold transition hover:bg-stage-300"
        >
          <Avatar name={name} className="h-8 w-8 text-sm" />
          <span className="truncate">{name}</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3">
        {tab === "search" ? (
          <SearchPanel code={code} name={name} current={current} queue={queue} onAdded={onAdded} />
        ) : tab === "queue" ? (
          <>
            {myTurn ?? (next ? (
              <div className="mb-3 rounded-card bg-stage-100 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your next song</p>
                <p className="mt-2 flex items-baseline gap-2.5">
                  <span className="font-display text-[2.5rem] font-extrabold leading-none tracking-tight">{ordinal(next.index + 1)}</span>
                  <span className="text-base font-semibold text-ink-muted">in line, {waitFor(next.index)}</span>
                </p>
                <p className="mt-2 truncate text-base font-semibold">{displayTitle(next.item.title)}</p>
              </div>
            ) : null)}
            {queue.length > 0 ? (
              <p className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
                {countSongs(queue.length)} waiting · {waitFor(queue.length)}
              </p>
            ) : null}
            <div className="-mx-2">
              {current ? <NowRow current={current} playing={state.isPlaying} /> : null}
              <QueuePanel
                queue={queue}
                isHost={false}
                onRemove={remove}
                emptyText={current ? "Nothing queued after this song." : "No songs yet. Be the first to add one."}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-5">
            {myTurn}
            {myCount > 0 ? (
              <section>
                <h2 className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your songs tonight</h2>
                <ul className="-mx-2 space-y-0.5">
                  {onNow ? (
                    <li>
                      <SongRow
                        thumbnailUrl={onNow.thumbnailUrl}
                        title={onNow.title}
                        subtitle={<span className="text-spotlight">Now singing</span>}
                        durationSeconds={onNow.durationSeconds}
                        className="bg-stage-100"
                      />
                    </li>
                  ) : null}
                  {mineQueued.map(({ item, index }) => (
                    <li key={item.id}>
                      <SongRow
                        thumbnailUrl={item.thumbnailUrl}
                        title={item.title}
                        subtitle={
                          index === 0 ? <span className="text-spotlight">Up next</span> : `${ordinal(index + 1)} in line, ${waitFor(index)}`
                        }
                        durationSeconds={item.durationSeconds}
                        className={index === 0 ? "bg-stage-100" : ""}
                        actions={
                          <IconButton label={`Remove ${item.title}`} onClick={() => remove(item.id)}>
                            <CloseIcon />
                          </IconButton>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="font-display text-2xl font-bold tracking-tight">No songs yet</p>
                <p className="mt-2 text-sm text-ink-muted">Songs you add show up here with your place in line.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setTab("search")}
              className="flex h-[3.25rem] items-center justify-center gap-2.5 rounded-full bg-stage-200 text-base font-semibold transition hover:bg-stage-300 active:scale-[0.98]"
            >
              <PlusIcon /> {myCount > 0 ? "Add another song" : "Find a song"}
            </button>
          </div>
        )}
      </div>

      {toast}

      {current && tab !== "queue" ? (
        <div className="mx-2 mb-2 flex items-center gap-2.5 rounded-row bg-stage-100 px-3 py-2">
          <Avatar name={current.addedBy} className="h-8 w-8 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-bold uppercase leading-[0.875rem] tracking-[0.1em] text-spotlight">
              {state.isPlaying ? "Now singing" : "Paused"}
            </p>
            <p className="truncate text-sm font-semibold leading-5">{current.addedBy} · {displayTitle(current.title)}</p>
          </div>
        </div>
      ) : null}

      <nav aria-label="Sections" className="flex border-t border-line bg-stage-100 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
            className={`flex min-h-12 flex-1 flex-col items-center gap-1 rounded-row py-1.5 text-xs ${
              tab === id ? "font-bold text-ink" : "font-semibold text-ink-muted"
            }`}
          >
            <span className={`grid h-[1.875rem] w-14 place-items-center rounded-full transition ${tab === id ? "bg-ink text-stage-000" : ""}`}>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** The spotlight card shown only when this guest is singing now or next. */
function TurnBanner({ overline, title, song }: { overline: string; title: ReactNode; song: string }) {
  return (
    <div className="animate-rise mb-3 rounded-card bg-spotlight px-5 pb-5 pt-6 text-on-spotlight">
      <p className="text-xs font-bold uppercase tracking-[0.1em]">{overline}</p>
      <p className="mt-3 font-display text-[3.25rem] font-extrabold leading-[0.95] tracking-tight">{title}</p>
      <p className="mt-3.5 text-lg font-bold leading-6">{song}</p>
    </div>
  );
}

function NowRow({ current, playing }: { current: QueueItem; playing: boolean }) {
  return (
    <SongRow
      leading={<Avatar name={current.addedBy} />}
      title={displayTitle(current.title)}
      subtitle={
        <>
          <span className="text-spotlight">{playing ? "Now singing" : "Paused"}</span> ·{" "}
          {current.mine ? <span className="text-ink">You</span> : current.addedBy}
        </>
      }
      className="mb-0.5 bg-stage-200 pl-3"
    />
  );
}
