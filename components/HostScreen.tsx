"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrigin, useStoredString } from "@/lib/browser-hooks";
import { sessionRequest, useSessionState } from "@/lib/useSessionState";
import { formatDuration } from "@/lib/format";
import { Forward10Icon, FullscreenIcon, MicIcon, NextIcon, PauseIcon, PlayIcon, VolumeIcon } from "./icons";
import { Player, type PlayerHandle, type Progress } from "./Player";
import { QrCode } from "./QrCode";
import { QueuePanel } from "./QueuePanel";
import { SearchPanel } from "./SearchPanel";
import { IconButton, SongRow } from "./SongRow";

const BIG_ICON = "h-9 w-9 min-[1920px]:h-14 min-[1920px]:w-14";

export function HostScreen({ code }: { code: string }) {
  const { state, status, refresh } = useSessionState(code);
  const origin = useOrigin();
  const joinUrl = origin ? `${origin}/join/${code}` : "";
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"queue" | "search">("queue");
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ seconds: 0, duration: 0 });
  // The host screen is the authority on play/pause once it has loaded.
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  const [storedVolume, setStoredVolume] = useStoredString("karaoke:volume");
  const [queueHidden, setQueueHidden] = useStoredString("karaoke:queue-hidden");
  const showQueue = queueHidden !== "1";
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

  // Remote controls and keyboards: media keys work anywhere; Space works unless a control has focus.
  useEffect(() => {
    if (!state?.isHost) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest("input, button, a, textarea, select");
      if (e.key === "MediaPlayPause" || (e.key === " " && !onControl)) {
        e.preventDefault();
        if (current) setPlaying(!playing);
      } else if (e.key === "MediaPlay") {
        if (current) setPlaying(true);
      } else if (e.key === "MediaPause") {
        if (current) setPlaying(false);
      } else if (e.key === "MediaTrackNext") {
        if (current) skip(current.id);
      } else if (e.key === "MediaFastForward") {
        playerRef.current?.seekBy(10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state?.isHost, current, playing, setPlaying, skip]);

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

  if (status === "not_found" || status === "archived") {
    return (
      <CenteredMessage title="This session has ended">
        Sessions close after 15 minutes without the main screen open.{" "}
        <Link href="/" className="text-rose-400 underline">Start a new session</Link>.
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
          <span className="hidden sm:inline">Session</span>
          <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-base font-semibold tracking-widest text-white">
            {code}
          </span>
          <button
            type="button"
            aria-expanded={showQueue}
            aria-controls="queue-panel"
            onClick={() => setQueueHidden(showQueue ? "1" : null)}
            className="h-12 rounded-full bg-white/10 px-6 text-base font-medium text-white transition hover:bg-white/15 min-[1920px]:h-16 min-[1920px]:px-8 min-[1920px]:text-xl"
          >
            {showQueue ? "Hide queue" : `Show queue (${state.queue.length})`}
          </button>
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
                onProgress={setProgress}
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

          {isHost && current ? (
            <div className="mt-3 flex items-center gap-3 text-sm tabular-nums text-neutral-400 min-[1920px]:text-xl">
              <span className="w-12 text-right min-[1920px]:w-16">{formatDuration(progress.seconds) || "0:00"}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(progress.duration || current.durationSeconds))}
                value={Math.floor(progress.seconds)}
                aria-label="Song position"
                onChange={(e) => {
                  const seconds = Number(e.target.value);
                  setProgress((p) => ({ ...p, seconds }));
                  playerRef.current?.seekTo(seconds);
                }}
                className="h-2 min-w-0 flex-1 cursor-pointer accent-rose-500"
              />
              <span className="w-12 min-[1920px]:w-16">{formatDuration(progress.duration || current.durationSeconds)}</span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400 min-[1920px]:text-base">
                {current ? (playing ? "Now singing" : "Paused") : "Nothing playing"}
              </p>
              <h2 className="truncate text-xl font-semibold min-[1920px]:text-4xl" title={current?.title}>
                {current?.title ?? "The queue is empty"}
              </h2>
              <p className="truncate text-sm text-neutral-400 min-[1920px]:text-xl">
                {current ? `Added by ${current.addedBy}` : "Add a song to get the party started."}
              </p>
            </div>

            {isHost ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={playing ? "Pause" : "Play"}
                  title={playing ? "Pause" : "Play"}
                  disabled={!current}
                  onClick={() => setPlaying(!playing)}
                  autoFocus
                  className="mx-2 grid h-20 w-20 place-items-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 min-[1920px]:h-28 min-[1920px]:w-28"
                >
                  {playing && current ? <PauseIcon className={BIG_ICON} /> : <PlayIcon className={BIG_ICON} />}
                </button>
                <IconButton size="lg" label="Forward 10 seconds" onClick={() => playerRef.current?.seekBy(10)} disabled={!current}>
                  <Forward10Icon className={BIG_ICON} />
                </IconButton>
                <IconButton size="lg" label="Next song" onClick={() => current && skip(current.id)} disabled={!current}>
                  <NextIcon className={BIG_ICON} />
                </IconButton>
                <label className="ml-3 hidden items-center gap-3 text-neutral-400 sm:flex">
                  <VolumeIcon className="h-7 w-7 min-[1920px]:h-10 min-[1920px]:w-10" />
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
                    className="h-2 w-28 accent-rose-500 min-[1920px]:w-48"
                  />
                </label>
                <IconButton
                  size="lg"
                  label="Full screen"
                  disabled={!current}
                  onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen();
                    else stageRef.current?.requestFullscreen?.();
                  }}
                >
                  <FullscreenIcon className="h-7 w-7 min-[1920px]:h-10 min-[1920px]:w-10" />
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
        <aside
          id="queue-panel"
          hidden={!showQueue}
          className={`${showQueue ? "flex" : ""} min-h-0 w-full flex-col border-t border-white/10 lg:w-[420px] lg:border-l lg:border-t-0 min-[1920px]:w-[440px] min-[1920px]:[zoom:1.3]`}
        >
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
                className={`h-12 rounded-full px-5 text-base font-medium transition ${
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
