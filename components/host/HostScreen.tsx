"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, useExpiringState, useFullscreen, useOrigin, useStoredString, useWakeLock } from "@/lib/client/browser-hooks";
import { endSession, sendPlayback, type MutationOutcome } from "@/lib/client/session-api";
import { useSessionState } from "@/lib/client/use-session-state";
import { formatWait } from "@/lib/domain/format";
import { failureMessage, isFailure } from "@/lib/domain/messages";
import { clampVolume, playingLabel, SEEK_STEP_SECONDS, upNextBannerVisible, type HostKeyCommand } from "@/lib/domain/playback";
import { waitSeconds } from "@/lib/domain/queue";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";
import { CenteredMessage, SessionLoadingMessage } from "../CenteredMessage";
import { Logo } from "../Logo";
import { QueuePanel } from "../QueuePanel";
import { SearchPanel } from "../SearchPanel";
import { HostLobby } from "./HostLobby";
import { JoinCard, JoinCorner } from "./JoinCard";
import { Player, savedPosition, type PlayerHandle, type Progress } from "./Player";
import { SingerIntro } from "./SingerIntro";
import { OVERLINE } from "./styles";
import { SeekBar, TransportControls } from "./TransportControls";
import { UpNextBanner, UpNextList } from "./UpNext";
import { useHostKeys } from "./use-host-keys";

/**
 * The main screen is drawn on a 1920 x 1080 grid in rem and the root font size follows the
 * viewport, so it looks the same on a laptop, a 1080p TV and a 4K TV (docs/adr/0009).
 */
const TV_SCALE = "html{font-size:max(10px,min(0.8333vw,1.4815vh))}";
const NOTICE_MS = 6000;
/** How long "End session" waits for its second press before going back to normal. */
const END_CONFIRM_MS = 5000;
/** The name songs added from the main screen go under. */
const HOST_SINGER_NAME = "Host";

const RAIL_TABS = [["next", "Up next"], ["edit", "Edit queue"], ["add", "Add a song"]] as const;
type RailTab = (typeof RAIL_TABS)[number][0];

const NO_PROGRESS: Progress = { seconds: 0, duration: 0 };

/** The main screen (/s/CODE): the video with the host's controls, and the queue beside it. */
export function HostScreen({ code }: { code: string }) {
  const [notice, setNotice] = useExpiringState<string>(NOTICE_MS);
  const { state, status, reconnecting, refresh, remove, move } = useSessionState(code, setNotice);
  const origin = useOrigin();
  const join = { joinUrl: origin ? `${origin}/join/${code}` : "", joinHost: origin.replace(/^https?:\/\//, ""), code };
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<RailTab>("next");
  const [progress, setProgress] = useState<Progress>(NO_PROGRESS);
  // The host screen is the authority on play/pause once it has loaded.
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  const [storedVolume, setStoredVolume] = useStoredString(STORAGE_KEYS.volume);
  const [queueHidden, setQueueHidden] = useStoredString(STORAGE_KEYS.queueHidden);
  const fullscreen = useFullscreen();
  const showQueue = queueHidden !== "1";
  const volume = clampVolume(storedVolume);

  // Each new song starts with a short "you're up" call-out, except when a reload resumes mid-song.
  const [seenId, setSeenId] = useState<string | null | undefined>(undefined);
  const [introId, setIntroId] = useState<string | null>(null);
  const currentId = state ? (state.current?.id ?? null) : undefined;
  if (currentId !== undefined && currentId !== seenId) {
    const resumed = seenId === undefined && currentId !== null && savedPosition(currentId) > 0;
    setSeenId(currentId);
    setIntroId(currentId && state?.isHost && !resumed ? currentId : null);
    setProgress(NO_PROGRESS);
  }

  const current = state?.current ?? null;
  const playing = localPlaying ?? state?.isPlaying ?? true;
  const intro = current !== null && introId === current.id;

  // Says so when a playback change did not reach the server, which is what the phones follow.
  const reportIfFailed = useCallback(
    (outcome: MutationOutcome, fallback: string) => {
      if (isFailure(outcome)) setNotice(failureMessage(outcome, fallback));
    },
    [setNotice],
  );

  const setPlaying = useCallback(
    async (next: boolean) => {
      setLocalPlaying(next);
      reportIfFailed(await sendPlayback(code, next ? "play" : "pause"), "Couldn't tell the phones. They may show the wrong thing for a moment.");
    },
    [code, reportIfFailed],
  );

  const startNow = useCallback(() => {
    setIntroId(null);
    setPlaying(true);
  }, [setPlaying]);

  const skip = useCallback(
    async (itemId: string) => {
      setLocalPlaying(true);
      reportIfFailed(await sendPlayback(code, "next", itemId), "Couldn't move on to the next song. Try again.");
      refresh();
    },
    [code, refresh, reportIfFailed],
  );

  // Ending a session cannot be undone, so it takes two presses: the first only arms the button.
  const [endArmed, setEndArmed] = useExpiringState<true>(END_CONFIRM_MS);
  const onEndSession = async () => {
    if (!endArmed) return setEndArmed(true);
    setEndArmed(null);
    reportIfFailed(await endSession(code), "Couldn't end the session. Try again.");
    refresh();
  };

  // A sleeping screen stops polling, and fifteen minutes of that ends the session.
  useWakeLock(!!state?.isHost);

  const seekForward = () => playerRef.current?.seekBy(SEEK_STEP_SECONDS);

  useHostKeys(!!state?.isHost, (command: HostKeyCommand) => {
    if (command === "forward") return seekForward();
    if (!current) return;
    if (command === "next") skip(current.id);
    else if (command === "pause") {
      if (!intro) setPlaying(false);
    } else if (intro) startNow();
    else setPlaying(command === "play" ? true : !playing);
  });

  // Titles outlive their queue item, so a skip notice can still name a song that is gone.
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
    [skip, setNotice],
  );

  if (status === "not_found" || status === "archived") {
    return (
      <CenteredMessage title="This session has ended">
        It was ended from the main screen, or closed itself after 15 minutes without one.{" "}
        <Link href="/" className="font-semibold text-encore underline">Start a new session</Link>.
      </CenteredMessage>
    );
  }
  if (!state) return <SessionLoadingMessage status={status} />;

  const { isHost, queue } = state;
  // Only the host adds songs here: anyone else on this page has no name yet, and goes to the guest screen for one.
  const railTabs = RAIL_TABS.filter(([id]) => isHost || id !== "add");
  const shownTab = railTabs.some(([id]) => id === tab) ? tab : "next";
  const duration = progress.duration || current?.durationSeconds || 0;
  const upNext = queue[0];
  const showBanner = upNextBannerVisible({ hasNext: !!upNext, intro, duration: progress.duration, seconds: progress.seconds });
  const showJoinCorner = !!current && (!showQueue || fullscreen);
  const queueWait = formatWait(waitSeconds(current, queue, queue.length, current ? progress.seconds : undefined));

  return (
    <div className="flex min-h-dvh flex-col gap-8 p-6 lg:h-dvh lg:flex-row lg:gap-12 lg:px-24 lg:py-[3.375rem]">
      <style>{TV_SCALE}</style>

      {/* Left: video and transport controls */}
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex h-12 shrink-0 items-center gap-6">
          <Link href="/" className="rounded-row">
            <Logo mark="h-12 w-12" word="text-[2rem]" />
          </Link>
          {/* Plain text, not a link: no focus stop that could navigate away mid-party. */}
          <span className="hidden text-[1.25rem] font-medium text-ink-faint sm:inline">by edmel.dev</span>
          {reconnecting ? (
            <span role="status" className="rounded-full bg-notice-ground px-5 py-2 text-[1.25rem] font-semibold text-notice">Reconnecting…</span>
          ) : null}
          {isHost ? (
            <button
              type="button"
              onClick={onEndSession}
              className={`ml-auto h-14 rounded-full px-7 text-[1.375rem] font-semibold transition active:scale-[0.97] ${
                endArmed ? "bg-encore text-on-encore hover:bg-encore-hover" : "text-ink-muted hover:bg-stage-200 hover:text-ink"
              }`}
            >
              {endArmed ? "End for everyone?" : "End session"}
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={showQueue}
            aria-controls="queue-panel"
            onClick={() => setQueueHidden(showQueue ? "1" : null)}
            className={`${isHost ? "" : "ml-auto"} h-14 rounded-full bg-stage-200 px-7 text-[1.375rem] font-semibold transition hover:bg-stage-300 active:scale-[0.97]`}
          >
            {showQueue ? "Hide queue" : `Show queue (${queue.length})`}
          </button>
        </header>

        {notice ? (
          <p role="status" className="animate-rise rounded-row bg-notice-ground px-6 py-3 text-[1.5rem] font-semibold text-notice">{notice}</p>
        ) : null}

        <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-card bg-stage-100 lg:aspect-auto lg:min-h-0 lg:flex-1">
          {intro && isHost ? (
            <SingerIntro key={current.id} item={current} then={queue} onStart={startNow} onSkip={() => skip(current.id)} />
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
            <HostLobby {...join} />
          )}

          {showBanner ? <UpNextBanner item={upNext} remainingSeconds={duration - progress.seconds} narrow={showJoinCorner} /> : null}
          {showJoinCorner ? <JoinCorner {...join} /> : null}
        </div>

        {isHost && current && !intro ? (
          <SeekBar
            seconds={progress.seconds}
            duration={duration}
            onSeek={(seconds) => {
              setProgress((p) => ({ ...p, seconds }));
              playerRef.current?.seekTo(seconds);
            }}
          />
        ) : null}

        {current || !isHost ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-4 lg:min-h-[9rem]">
          <div className="min-w-0 flex-1 basis-[24rem]">
            <p className={`${OVERLINE} ${current && playing && !intro ? "text-spotlight" : "text-ink-muted"}`}>
              {current ? (intro ? "Up next" : playingLabel(playing)) : "Nothing playing"}
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
            <TransportControls
              hasCurrent={!!current}
              intro={intro}
              playing={playing}
              volume={volume}
              onPlayPause={() => (intro ? startNow() : setPlaying(!playing))}
              onForward={seekForward}
              onNext={() => current && skip(current.id)}
              onVolume={(next) => {
                setStoredVolume(String(next));
                playerRef.current?.setVolume(next);
              }}
              onFullscreen={() => {
                if (document.fullscreenElement) document.exitFullscreen();
                else stageRef.current?.requestFullscreen?.();
              }}
            />
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
        <div
          className="flex gap-1 rounded-full bg-stage-000 p-1.5"
          role="tablist"
          aria-label="Queue panel"
          onKeyDown={(e) => {
            // Left and right move between tabs, as on any tab list and as a TV remote expects.
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const index = railTabs.findIndex(([id]) => id === shownTab);
            const [nextId] = railTabs[(index + step + railTabs.length) % railTabs.length];
            setTab(nextId);
            document.getElementById(`queue-tab-${nextId}`)?.focus();
          }}
        >
          {railTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`queue-tab-${id}`}
              aria-controls="queue-tabpanel"
              aria-selected={shownTab === id}
              tabIndex={shownTab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`h-12 flex-1 rounded-full text-[1.25rem] font-semibold transition ${
                shownTab === id ? "bg-ink text-stage-000" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Rows in the lists bleed past their column; the side padding holds that so no sideways scrollbar appears. */}
        <div
          role="tabpanel"
          id="queue-tabpanel"
          aria-labelledby={`queue-tab-${shownTab}`}
          className="-mx-3 flex min-h-64 flex-1 flex-col overflow-y-auto px-3 lg:min-h-0"
        >
          {shownTab === "next" ? (
            <UpNextList queue={queue} hasCurrent={!!current} queueWait={queueWait} />
          ) : (
            // Phone-sized controls, enlarged a step: these are used up close, not read from the sofa.
            <div className="flex min-h-0 flex-1 flex-col lg:[zoom:1.3]">
              {shownTab === "edit" ? (
                <QueuePanel
                  queue={queue}
                  isHost={isHost}
                  onRemove={remove}
                  onMove={isHost ? move : undefined}
                  emptyText={current ? "Nothing queued after this song." : "No songs yet. Scan the code to add one."}
                />
              ) : (
                <SearchPanel code={code} name={HOST_SINGER_NAME} current={current} queue={queue} onAdded={refresh} />
              )}
            </div>
          )}
        </div>

        {current ? <JoinCard {...join} /> : null}
      </aside>
    </div>
  );
}
