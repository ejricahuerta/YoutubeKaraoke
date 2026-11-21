"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrigin, useStoredString } from "@/lib/browser-hooks";
import { sessionRequest, useSessionState } from "@/lib/useSessionState";
import { FullscreenIcon, MicIcon, NextIcon, PauseIcon, PlayIcon, RestartIcon, VolumeIcon } from "./icons";
import { Player, type PlayerHandle } from "./Player";
import { QrCode } from "./QrCode";
import { QueuePanel } from "./QueuePanel";
import { SearchPanel } from "./SearchPanel";
import { IconButton, SongRow } from "./SongRow";

export function HostScreen({ code }: { code: string }) {
  const { state, status, refresh } = useSessionState(code);
  const origin = useOrigin();
  const joinUrl = origin ? `${origin}/join/${code}` : "";
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"queue" | "search">("queue");
  const [notice, setNotice] = useState<string | null>(null);
  // The host screen is the authority on play/pause once it has loaded.
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  const [storedVolume, setStoredVolume] = useStoredString("karaoke:volume");
  const volume = storedVolume ? Math.min(100, Math.max(0, Number(storedVolume) || 0)) : 100;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const api = `/api/sessions/${code}`;
  const current = state?.current ?? null;
  const playing = localPlaying ?? state?.isPlaying ?? true;

  const setPlaying = useCallback(
    (next: boolean) => {
      setLocalPlaying(next);
      sessionRequest(`${api}/playback`, "POST", { action: next ? "play" : "pause" });
    },
    [api],
  );

  const skip = useCallback(
    async (itemId: string) => {
      setLocalPlaying(true);
      await sessionRequest(`${api}/playback`, "POST", { action: "next", expectedItemId: itemId });
      refresh();
    },
    [api, refresh],
  );

  const titles = useRef(new Map<string, string>());
  useEffect(() => {
    if (current) titles.current.set(current.id, current.title);
  }, [current]);

  const onPlayerError = useCallback(
    (itemId: string) => {
      const title = titles.current.get(itemId) ?? "That video";
      setNotice(`Skipped "${title}": YouTube won't let it play here.`);
      skip(itemId);
    },
    [skip],
  );

  const remove = useCallback(
    async (id: string) => {
      await sessionRequest(`${api}/queue/${id}`, "DELETE");
      refresh();
    },
    [api, refresh],
  );

  const move = useCallback(
    async (id: string, afterId: string | null) => {
      await sessionRequest(`${api}/queue/${id}`, "PATCH", { afterId });
      refresh();
    },
    [api, refresh],
  );

  if (status === "not_found") {
    return (
      <CenteredMessage title="This session has ended">
        Sessions close after a day without activity.{" "}
        <Link href="/" className="text-rose-400 underline">Start a new one</Link>.
      </CenteredMessage>
    );
  }
  if (!state) {
    return (
      <CenteredMessage title={status === "error" ? "Can't reach the server" : "Loading…"}>
        {status === "error" ? "Check your connection. This page will keep retrying." : null}
      </CenteredMessage>
    );
  }

  const isHost = state.isHost;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-rose-600"><MicIcon className="h-5 w-5" /></span>
          Karaoke
        </Link>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          Session
          <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-base font-semibold tracking-widest text-white">
            {code}
          </span>
        </div>
      </header>

      {notice ? (
        <p role="status" className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200 lg:px-6">{notice}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: video and transport controls */}
        <main className="flex min-w-0 flex-1 flex-col p-4 lg:p-6">
          <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900 lg:aspect-auto lg:min-h-0 lg:flex-1">
            {current && isHost ? (
              <Player
                ref={playerRef}
                itemId={current.id}
                videoId={current.videoId}
                playing={playing}
                volume={volume}
                onEnded={skip}
                onError={onPlayerError}
                onPlayingChange={setPlaying}
              />
            ) : current ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <img src={current.thumbnailUrl} alt="" className="mx-auto mb-4 w-64 rounded-xl" />
                  <p className="text-neutral-300">The video plays on the screen that started this session.</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center sm:flex-row sm:text-left">
                {joinUrl ? <QrCode url={joinUrl} size={220} /> : <div className="h-[220px] w-[220px] rounded-xl bg-white/10" />}
                <div className="max-w-sm">
                  <h1 className="text-3xl font-bold">Scan to pick a song</h1>
                  <p className="mt-2 text-neutral-400">
                    Point your phone camera at the code, search for a song and add it. It starts playing here.
                  </p>
                  <p className="mt-4 break-all font-mono text-sm text-neutral-300">{joinUrl}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                {current ? (playing ? "Now singing" : "Paused") : "Nothing playing"}
              </p>
              <h2 className="truncate text-xl font-semibold" title={current?.title}>
                {current?.title ?? "The queue is empty"}
              </h2>
              <p className="truncate text-sm text-neutral-400">
                {current ? `Added by ${current.addedBy}` : "Add a song to get the party started."}
              </p>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1">
                <IconButton label="Restart song" onClick={() => playerRef.current?.restart()} disabled={!current}>
                  <RestartIcon />
                </IconButton>
                <button
                  type="button"
                  aria-label={playing ? "Pause" : "Play"}
                  title={playing ? "Pause" : "Play"}
                  disabled={!current}
                  onClick={() => setPlaying(!playing)}
                  className="mx-1 grid h-14 w-14 place-items-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                >
                  {playing && current ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7" />}
                </button>
                <IconButton label="Next song" onClick={() => current && skip(current.id)} disabled={!current}>
                  <NextIcon />
                </IconButton>
                <label className="ml-3 hidden items-center gap-2 text-neutral-400 sm:flex">
                  <VolumeIcon />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    aria-label="Volume"
                    onChange={(e) => {
                      setStoredVolume(e.target.value);
                      playerRef.current?.setVolume(Number(e.target.value));
                    }}
                    className="w-24 accent-rose-500"
                  />
                </label>
                <IconButton
                  label="Full screen"
                  disabled={!current}
                  onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen();
                    else stageRef.current?.requestFullscreen?.();
                  }}
                >
                  <FullscreenIcon />
                </IconButton>
              </div>
            ) : (
              <Link href={`/join/${code}`} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold hover:bg-rose-500">
                Add songs from this device
              </Link>
            )}
          </div>
        </main>

        {/* Right: join code and queue */}
        <aside className="flex min-h-0 w-full flex-col border-t border-white/10 lg:w-[420px] lg:border-l lg:border-t-0">
          <div className="flex items-center gap-4 border-b border-white/10 p-4">
            {joinUrl ? <QrCode url={joinUrl} size={96} /> : <div className="h-24 w-24 rounded-xl bg-white/10" />}
            <div className="min-w-0">
              <p className="font-semibold">Scan to add songs</p>
              <p className="mt-0.5 text-sm text-neutral-400">or open this address on your phone:</p>
              <p className="mt-1 break-all font-mono text-xs text-neutral-300">{joinUrl.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>

          <div className="flex gap-2 px-4 pt-3" role="tablist">
            {([["queue", `Up next (${state.queue.length})`], ["search", "Add a song"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition ${
                  tab === id ? "bg-white text-black" : "bg-white/10 text-neutral-200 hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex min-h-64 flex-1 flex-col overflow-y-auto p-2 lg:min-h-0">
            {tab === "queue" ? (
              <>
                {current ? (
                  <SongRow
                    thumbnailUrl={current.thumbnailUrl}
                    title={current.title}
                    subtitle={<><span className="text-rose-400">Now singing</span> · {current.addedBy}</>}
                    durationSeconds={current.durationSeconds}
                    className="mb-1 bg-white/5"
                  />
                ) : null}
                <QueuePanel
                  queue={state.queue}
                  isHost={isHost}
                  onRemove={remove}
                  onMove={isHost ? move : undefined}
                  emptyText={current ? "Nothing queued after this song." : "No songs yet. Scan the code to add one."}
                />
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-2">
                <SearchPanel code={code} name="Host" onAdded={refresh} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function CenteredMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {children ? <p className="mt-2 text-neutral-400">{children}</p> : null}
      </div>
    </div>
  );
}
