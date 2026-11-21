"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOrigin, useStoredString } from "@/lib/browser-hooks";
import { displayTitle, formatDuration } from "@/lib/format";
import { countSongs, formatWait, waitSeconds } from "@/lib/singers";
import type { QueueItem } from "@/lib/types";
import { sessionRequest, useSessionState } from "@/lib/useSessionState";
import { Avatar } from "./Avatar";
import { Credit } from "./Credit";
import { Forward10Icon, FullscreenIcon, NextIcon, PauseIcon, PlayIcon, VolumeIcon } from "./icons";
import { Logo } from "./Logo";
import { Player, savedPosition, type PlayerHandle, type Progress } from "./Player";
import { QrCode } from "./QrCode";
import { QueuePanel } from "./QueuePanel";
import { SearchPanel } from "./SearchPanel";
import { IconButton } from "./SongRow";

/**
 * The main screen is drawn on a 1920 x 1080 grid in rem and the root font size follows the
 * viewport, so it looks the same on a laptop, a 1080p TV and a 4K TV.
 */
const TV_SCALE = "html{font-size:max(10px,min(0.8333vw,1.4815vh))}";
/** How many upcoming singers the room sees; the rest collapse into "+N more". */
const UP_NEXT_ROWS = 4;
/** The pause before each song so the singer can get to the mic. */
const INTRO_SECONDS = 10;
/** The "up next" banner appears this long before the current song ends. */
const BANNER_SECONDS = 30;

const BIG_ICON = "h-12 w-12";
const OVERLINE = "text-[1.5rem] font-bold uppercase leading-none tracking-[0.08em]";

type RailTab = "next" | "edit" | "add";

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

export function HostScreen({ code }: { code: string }) {
  const { state, status, refresh } = useSessionState(code);
  const origin = useOrigin();
  const joinUrl = origin ? `${origin}/join/${code}` : "";
  const joinHost = origin.replace(/^https?:\/\//, "");
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<RailTab>("next");
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ seconds: 0, duration: 0 });
  // The host screen is the authority on play/pause once it has loaded.
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  const [storedVolume, setStoredVolume] = useStoredString("karaoke:volume");
  const [queueHidden, setQueueHidden] = useStoredString("karaoke:queue-hidden");
  const fullscreen = useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement !== null, () => false);
  const showQueue = queueHidden !== "1";
  const volume = storedVolume ? Math.min(100, Math.max(0, Number(storedVolume) || 0)) : 100;

  // Each new song starts with a short "you're up" call-out, except when a reload resumes mid-song.
  const [seenId, setSeenId] = useState<string | null | undefined>(undefined);
  const [introId, setIntroId] = useState<string | null>(null);
  const currentId = state ? (state.current?.id ?? null) : undefined;
  if (currentId !== undefined && currentId !== seenId) {
    const resumed = seenId === undefined && currentId !== null && savedPosition(currentId) > 0;
    setSeenId(currentId);
    setIntroId(currentId && state?.isHost && !resumed ? currentId : null);
    setProgress({ seconds: 0, duration: 0 });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const api = `/api/sessions/${code}`;
  const current = state?.current ?? null;
  const playing = localPlaying ?? state?.isPlaying ?? true;
  const intro = current && introId === current.id;

  const setPlaying = useCallback(
    (next: boolean) => {
      setLocalPlaying(next);
      sessionRequest(`${api}/playback`, "POST", { action: next ? "play" : "pause" });
    },
    [api],
  );

  const startNow = useCallback(() => {
    setIntroId(null);
    setPlaying(true);
  }, [setPlaying]);

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
    const toggle = () => {
      if (intro) startNow();
      else if (current) setPlaying(!playing);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest("input, button, a, textarea, select");
      if (e.key === "MediaPlayPause" || (e.key === " " && !onControl)) {
        e.preventDefault();
        toggle();
      } else if (e.key === "MediaPlay") {
        if (intro) startNow();
        else if (current) setPlaying(true);
      } else if (e.key === "MediaPause") {
        if (current && !intro) setPlaying(false);
      } else if (e.key === "MediaTrackNext") {
        if (current) skip(current.id);
      } else if (e.key === "MediaFastForward") {
        playerRef.current?.seekBy(10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state?.isHost, current, playing, intro, setPlaying, startNow, skip]);

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
        <Link href="/" className="font-semibold text-encore underline">Start a new session</Link>.
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

  const { isHost, queue } = state;
  const duration = progress.duration || current?.durationSeconds || 0;
  const remaining = duration - progress.seconds;
  const upNext = queue[0];
  const showBanner = !!upNext && !intro && progress.duration > 0 && remaining > 0 && remaining <= BANNER_SECONDS;
  const showBug = !!current && (!showQueue || fullscreen);
  const queueWait = formatWait(waitSeconds(current, queue, queue.length, current ? progress.seconds : undefined));

  return (
    <div className="flex min-h-dvh flex-col gap-8 p-6 lg:h-dvh lg:flex-row lg:gap-12 lg:px-24 lg:py-[3.375rem]">
      <style>{TV_SCALE}</style>

      {/* Left: video and transport controls */}
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex h-12 shrink-0 items-center gap-6">
          <Link href="/" className="rounded-row">
            <Logo tile="h-12 w-12 rounded-[0.9375rem]" icon="h-7 w-7" word="text-[2rem]" />
          </Link>
          {/* Plain text, not a link: no focus stop that could navigate away mid-party. */}
          <span className="hidden text-[1.25rem] font-medium text-ink-faint sm:inline">by edmel.dev</span>
          <button
            type="button"
            aria-expanded={showQueue}
            aria-controls="queue-panel"
            onClick={() => setQueueHidden(showQueue ? "1" : null)}
            className="ml-auto h-14 rounded-full bg-stage-200 px-7 text-[1.375rem] font-semibold transition hover:bg-stage-300 active:scale-[0.97]"
          >
            {showQueue ? "Hide queue" : `Show queue (${queue.length})`}
          </button>
        </header>

        {notice ? (
          <p role="status" className="animate-rise rounded-row bg-notice-ground px-6 py-3 text-[1.5rem] font-semibold text-notice">{notice}</p>
        ) : null}

        <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-card bg-stage-100 lg:aspect-auto lg:min-h-0 lg:flex-1">
          {intro && isHost ? (
            <UpNextIntro key={current.id} item={current} then={queue} onStart={startNow} onSkip={() => skip(current.id)} />
          ) : current && isHost ? (
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
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <img src={current.thumbnailUrl} alt="" className="mx-auto mb-6 w-[24rem] rounded-card" />
                <p className="text-[1.75rem] font-medium text-ink-muted">The video plays on the screen that started this session.</p>
              </div>
            </div>
          ) : (
            <Lobby joinUrl={joinUrl} joinHost={joinHost} code={code} />
          )}

          {showBanner ? (
            <div className={`animate-rise pointer-events-none absolute bottom-7 left-7 flex items-center gap-5 rounded-full bg-stage-000 py-4 pl-4 pr-8 shadow-lift ${showBug ? "right-[14rem]" : "right-7"}`}>
              <Avatar name={upNext.addedBy} className="h-16 w-16 text-[1.75rem]" />
              <span className={`${OVERLINE} shrink-0 text-ink-muted`}>Up next</span>
              <span className="shrink-0 text-[1.875rem] font-bold">{upNext.addedBy}</span>
              <span className="min-w-0 flex-1 truncate text-[1.875rem] font-medium text-ink-muted">{displayTitle(upNext.title)}</span>
              <span className="shrink-0 text-[1.5rem] font-semibold tabular-nums text-ink-muted">in {formatDuration(remaining) || "0:00"}</span>
            </div>
          ) : null}

          {showBug ? (
            <div className="pointer-events-none absolute bottom-7 right-7 flex flex-col items-center gap-2 rounded-card bg-stage-000 p-3 shadow-lift">
              <QrCode url={joinUrl} className="w-[9rem] rounded-row" />
              <span className="font-mono text-[1.5rem] leading-none tracking-[0.12em]">{code}</span>
            </div>
          ) : null}
        </div>

        {isHost && current && !intro ? (
          <div className="flex shrink-0 items-center gap-5 text-[1.5rem] font-semibold tabular-nums text-ink-muted">
            <span className="w-16 text-right">{formatDuration(progress.seconds) || "0:00"}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.floor(progress.seconds)}
              aria-label="Song position"
              onChange={(e) => {
                const seconds = Number(e.target.value);
                setProgress((p) => ({ ...p, seconds }));
                playerRef.current?.seekTo(seconds);
              }}
              className="h-2.5 min-w-0 flex-1 cursor-pointer accent-spotlight"
            />
            <span className="w-16">{formatDuration(duration)}</span>
          </div>
        ) : null}

        {current || !isHost ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-4 lg:min-h-[9rem]">
          <div className="min-w-0 flex-1 basis-[24rem]">
            <p className={`${OVERLINE} ${current && playing && !intro ? "text-spotlight" : "text-ink-muted"}`}>
              {current ? (intro ? "Up next" : playing ? "Now singing" : "Paused") : "Nothing playing"}
            </p>
            <h2 className="mt-2.5 line-clamp-2 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight" title={current?.title}>
              {current ? displayTitle(current.title) : "Waiting for the first song"}
            </h2>
            {current ? (
              <span className="mt-2.5 inline-flex items-center gap-3 rounded-full bg-stage-200 py-1.5 pl-1.5 pr-6 text-[1.625rem] font-semibold">
                <Avatar name={current.addedBy} className="h-11 w-11 text-[1.375rem]" />
                {current.addedBy}
              </span>
            ) : (
              <p className="mt-2 text-[1.5rem] font-medium text-ink-muted">The first song added starts right away.</p>
            )}
          </div>

          {isHost ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={intro ? "Start now" : playing ? "Pause" : "Play"}
                title={intro ? "Start now" : playing ? "Pause" : "Play"}
                disabled={!current}
                onClick={() => (intro ? startNow() : setPlaying(!playing))}
                autoFocus
                className="mr-4 grid h-[7.5rem] w-[7.5rem] place-items-center rounded-full bg-ink text-stage-000 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              >
                {playing && current && !intro ? <PauseIcon className="h-14 w-14" /> : <PlayIcon className="h-14 w-14" />}
              </button>
              <IconButton size="lg" label="Forward 10 seconds" onClick={() => playerRef.current?.seekBy(10)} disabled={!current || !!intro}>
                <Forward10Icon className={BIG_ICON} />
              </IconButton>
              <IconButton size="lg" label="Next song" onClick={() => current && skip(current.id)} disabled={!current}>
                <NextIcon className={BIG_ICON} />
              </IconButton>
              <label className="ml-2 hidden items-center gap-3 text-ink sm:flex">
                <VolumeIcon className="h-11 w-11" />
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
                  className="h-2.5 w-28 cursor-pointer accent-ink"
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
                <FullscreenIcon className="h-11 w-11" />
              </IconButton>
            </div>
          ) : (
            <Link href={`/join/${code}`} className="rounded-full bg-encore px-8 py-4 text-[1.5rem] font-bold text-on-encore hover:bg-encore-hover">
              Add songs from this device
            </Link>
          )}
        </div>
        ) : null}
      </main>

      {/* Right: who sings next, and how to join */}
      <aside
        id="queue-panel"
        hidden={!showQueue}
        className={`${showQueue ? "flex" : ""} min-h-0 w-full shrink-0 flex-col gap-4 rounded-panel bg-stage-100 p-8 lg:w-[32.5rem]`}
      >
        <div className="flex gap-1 rounded-full bg-stage-000 p-1.5" role="tablist">
          {([["next", "Up next"], ["edit", "Edit queue"], ["add", "Add a song"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-12 flex-1 rounded-full text-[1.25rem] font-semibold transition ${
                tab === id ? "bg-ink text-stage-000" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-64 flex-1 flex-col overflow-y-auto lg:min-h-0">
          {tab === "next" ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
                <h2 className="font-display text-[2.5rem] font-bold leading-none tracking-tight">Up next</h2>
                {queue.length > 0 ? (
                  <span className="text-[1.5rem] font-medium text-ink-muted">{countSongs(queue.length)} · {queueWait}</span>
                ) : null}
              </div>
              {queue.length === 0 ? (
                <p className="px-1 py-6 text-[1.5rem] font-medium leading-snug text-ink-muted">
                  {current ? "Nobody is waiting. Scan the code to sing next." : "No songs yet. Scan the code to add the first one."}
                </p>
              ) : (
                <ol className="space-y-2">
                  {queue.slice(0, UP_NEXT_ROWS).map((item, index) => (
                    <UpNextRow key={item.id} item={item} first={index === 0} />
                  ))}
                </ol>
              )}
              {queue.length > UP_NEXT_ROWS ? (
                <p className="mt-3 px-4 text-[1.5rem] font-semibold text-ink-muted">+{queue.length - UP_NEXT_ROWS} more</p>
              ) : null}
            </>
          ) : (
            // Phone-sized controls, enlarged a step: these are used up close, not read from the sofa.
            <div className="flex min-h-0 flex-1 flex-col lg:[zoom:1.3]">
              {tab === "edit" ? (
                <QueuePanel
                  queue={queue}
                  isHost={isHost}
                  onRemove={remove}
                  onMove={isHost ? move : undefined}
                  emptyText={current ? "Nothing queued after this song." : "No songs yet. Scan the code to add one."}
                />
              ) : (
                <SearchPanel code={code} name="Host" current={current} queue={queue} onAdded={refresh} />
              )}
            </div>
          )}
        </div>

        {current ? <JoinCard joinUrl={joinUrl} joinHost={joinHost} code={code} /> : null}
      </aside>
    </div>
  );
}

function UpNextRow({ item, first }: { item: QueueItem; first: boolean }) {
  const duration = formatDuration(item.durationSeconds);
  return (
    <li className={`flex items-center gap-5 rounded-card p-4 ${first ? "bg-stage-200" : ""}`}>
      <Avatar name={item.addedBy} className="h-16 w-16 text-[1.75rem]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.625rem] font-semibold leading-8">{displayTitle(item.title)}</p>
        <p className="mt-0.5 truncate text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">
          {item.addedBy}{duration ? ` · ${duration}` : ""}
        </p>
      </div>
    </li>
  );
}

/** QR code, address and session code: shown on the main screen in every state. */
function JoinCard({ joinUrl, joinHost, code }: { joinUrl: string; joinHost: string; code: string }) {
  return (
    <div className="flex shrink-0 items-center gap-7 rounded-card bg-stage-200 p-5">
      <QrCode url={joinUrl} className="w-[11rem] rounded-row" />
      <div className="min-w-0">
        <p className="text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">Scan to add songs, or go to</p>
        <p className="mt-1 text-[1.625rem] font-bold leading-8 [overflow-wrap:anywhere]">{joinHost}</p>
        <p className="mt-3 font-mono text-[2.75rem] leading-none tracking-[0.12em]">{code}</p>
      </div>
    </div>
  );
}

/** The main screen before the first song: how to join, as large as it can be. */
function Lobby({ joinUrl, joinHost, code }: { joinUrl: string; joinHost: string; code: string }) {
  const steps = [
    "Point your phone camera at the code",
    "Type your name and search for a song",
    "Tap add. It plays here on your turn",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 p-10 sm:flex-row sm:gap-16">
      <div className="flex min-w-0 flex-col gap-9">
        <h1 className="font-display text-[7.5rem] font-extrabold leading-[0.92] tracking-[-0.03em]">
          Scan.<br />Pick.<br /><span className="text-encore">Sing.</span>
        </h1>
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-5 text-[1.625rem] font-medium">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stage-300 text-[1.5rem] font-bold">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-6 rounded-panel bg-stage-200 p-9">
        <QrCode url={joinUrl} className="w-[21rem] rounded-card" />
        <p className="max-w-[24rem] text-center text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">
          No camera? Go to
          <span className="block font-bold text-ink [overflow-wrap:anywhere]">{joinHost}</span>
          and enter
        </p>
        <p className="font-mono text-[4.5rem] leading-none tracking-[0.14em] [margin-right:-0.14em]">{code}</p>
      </div>
    </div>
  );
}

/** "Leo, you're up!": a short countdown before each song so the singer can reach the mic. */
function UpNextIntro({
  item,
  then,
  onStart,
  onSkip,
}: {
  item: QueueItem;
  then: QueueItem[];
  onStart: () => void;
  onSkip: () => void;
}) {
  const [left, setLeft] = useState(INTRO_SECONDS);
  useEffect(() => {
    const timer = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onStart();
  }, [left, onStart]);

  const circumference = 2 * Math.PI * 150;
  return (
    <div className="flex h-full flex-col justify-center gap-10 bg-stage-000 px-14 py-10">
      <div className="flex items-center gap-14">
        <div className="relative h-[17.5rem] w-[17.5rem] shrink-0">
          <svg viewBox="0 0 320 320" aria-hidden className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="160" cy="160" r="150" fill="none" strokeWidth="12" className="stroke-stage-300" />
            <circle
              cx="160" cy="160" r="150" fill="none" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, left) / INTRO_SECONDS)}
              className="stroke-spotlight transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <Avatar name={item.addedBy} className="absolute inset-[2.25rem] font-display text-[7rem] font-extrabold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`${OVERLINE} text-spotlight`} aria-live="polite">Up next · starts in {Math.max(0, left)}</p>
          <h1 className="mt-5 font-display text-[7rem] font-extrabold leading-[0.92] tracking-[-0.03em] [overflow-wrap:anywhere]">
            {item.addedBy},<br />you&apos;re up!
          </h1>
          <p className="mt-6 line-clamp-2 font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-ink-muted">{displayTitle(item.title)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="flex h-20 items-center gap-4 rounded-full bg-ink pl-8 pr-10 text-[1.75rem] font-bold text-stage-000 transition hover:scale-[1.03] active:scale-[0.97]"
          >
            <PlayIcon className="h-9 w-9" /> Start now
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-20 max-w-[22rem] truncate rounded-full bg-stage-200 px-9 text-[1.75rem] font-semibold transition hover:bg-stage-300 active:scale-[0.97]"
          >
            Skip {item.addedBy}
          </button>
        </div>
        {then.length > 0 ? (
          <div className="flex min-w-0 items-center gap-4 text-[1.625rem] font-semibold">
            <span className={`${OVERLINE} text-ink-muted`}>Then</span>
            {then.slice(0, 3).map((q) => (
              <span key={q.id} className="flex min-w-0 items-center gap-3">
                <Avatar name={q.addedBy} className="h-12 w-12 text-[1.375rem]" />
                <span className="truncate">{q.addedBy}</span>
              </span>
            ))}
            {then.length > 3 ? <span className="shrink-0 font-medium text-ink-muted">+{then.length - 3} more</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CenteredMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="inline-flex"><Logo label={null} tile="h-12 w-12 rounded-[0.9375rem]" icon="h-7 w-7" /></span>
        <h1 className="mt-5 font-display text-[2rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        {children ? <p className="mt-2 text-base text-ink-muted">{children}</p> : null}
        <Credit className="mt-8" />
      </div>
    </div>
  );
}
