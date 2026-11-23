"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { STORAGE_KEYS, useExpiringState, useFullscreen, useOrigin, useStoredString, useWakeLock } from "@/lib/client/browser-hooks";
import { endSession, freeRemote, playSongNow, sendPlayback, setTakeTurns, takeOver, type MutationOutcome } from "@/lib/client/session-api";
import { useMicrophone } from "@/lib/client/use-microphone";
import { useSessionState } from "@/lib/client/use-session-state";
import { formatDuration } from "@/lib/domain/format";
import { failureMessage, idleNotice, isFailure } from "@/lib/domain/messages";
import { micStatusMessage } from "@/lib/domain/microphone";
import { clampVolume, playingLabel, SEEK_STEP_SECONDS, upNextBannerVisible, type HostKeyCommand } from "@/lib/domain/playback";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";
import { CenteredMessage, SessionLoadingMessage } from "../CenteredMessage";
import { BackIcon, CheckIcon, EditIcon, MicIcon, PlayIcon, PlusIcon, PowerIcon } from "../Icons";
import { Logo } from "../Logo";
import { QueuePanel } from "../QueuePanel";
import { SearchPanel } from "../SearchPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { HostLobby } from "./HostLobby";
import { JoinCard, JoinCorner } from "./JoinCard";
import { MicrophonePanel } from "./MicrophonePanel";
import { Player, savedPosition, type PlayerHandle, type Progress } from "./Player";
import { SettingsMenu } from "./SettingsMenu";
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
/**
 * After the host adds a song, the panel goes back to "Up next" once this long passes with no
 * typing or tapping in it, so the room sees the queue again.
 */
const BACK_TO_UP_NEXT_MS = 30_000;
/** The name songs added from the main screen go under. */
const HOST_SINGER_NAME = "Host";

/** What the queue panel shows: the list, the list with edit buttons, or search. */
type RailView = "next" | "edit" | "add";

const NO_PROGRESS: Progress = { seconds: 0, duration: 0 };

/** The main screen (/s/CODE): the video with the host's controls, and the queue beside it. */
export function HostScreen({ code, takeover }: { code: string; takeover?: string }) {
  const [notice, setNotice] = useExpiringState<string>(NOTICE_MS);
  const { state, status, reconnecting, refresh, remove, move } = useSessionState(code, setNotice);
  const origin = useOrigin();
  const join = { joinUrl: origin ? `${origin}/join/${code}` : "", joinHost: origin.replace(/^https?:\/\//, ""), code };
  const playerRef = useRef<PlayerHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [railView, setRailView] = useState<RailView>("next");
  // Bumped by each add, and by activity in the panel after one; 0 means no switch back is due.
  const [backToUpNext, setBackToUpNext] = useState(0);
  useEffect(() => {
    if (!backToUpNext || railView !== "add") return;
    const timer = setTimeout(() => {
      setRailView("next");
      setBackToUpNext(0);
    }, BACK_TO_UP_NEXT_MS);
    return () => clearTimeout(timer);
  }, [backToUpNext, railView]);
  /** A view the host picks stays put: it cancels any switch back that was due. */
  function chooseRailView(next: RailView) {
    setRailView(next);
    setBackToUpNext(0);
  }
  // Leaving search puts the focus back on "Add a song", so a remote is not left nowhere.
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const focusAddButton = useRef(false);
  useEffect(() => {
    if (focusAddButton.current && railView !== "add") {
      focusAddButton.current = false;
      addButtonRef.current?.focus();
    }
  }, [railView]);
  /** Still searching after an add: start the wait again. */
  function keepAddTabOpen() {
    if (backToUpNext) setBackToUpNext((n) => n + 1);
  }
  const [progress, setProgress] = useState<Progress>(NO_PROGRESS);
  // The host screen acts on its own play/pause at once rather than waiting for the server...
  const [localPlaying, setLocalPlaying] = useState<boolean | null>(null);
  // ...but the phone remote can play and pause too (migration 0010), so when the server's
  // value changes, follow it. A stale poll repeats the old value and changes nothing.
  const serverPlaying = state?.isPlaying;
  const [seenServerPlaying, setSeenServerPlaying] = useState<boolean | undefined>(undefined);
  if (serverPlaying !== undefined && serverPlaying !== seenServerPlaying) {
    setSeenServerPlaying(serverPlaying);
    if (seenServerPlaying !== undefined) setLocalPlaying(serverPlaying);
  }
  const [storedVolume, setStoredVolume] = useStoredString(STORAGE_KEYS.volume);
  const [queueHidden, setQueueHidden] = useStoredString(STORAGE_KEYS.queueHidden);
  const fullscreen = useFullscreen();
  const showQueue = queueHidden !== "1";
  const volume = clampVolume(storedVolume);
  // Only the screen that plays the video sings through its speakers (docs/adr/0024).
  const mic = useMicrophone(!!state?.isHost);
  const [showMic, setShowMic] = useState(false);

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

  // Opened from a "move the main screen" link (migration 0014): become the main screen once,
  // then drop the secret from the address so a reload or a shared screenshot cannot reuse it.
  const router = useRouter();
  const tookOver = useRef(false);
  useEffect(() => {
    if (!takeover || tookOver.current) return;
    tookOver.current = true;
    takeOver(code, takeover).then((outcome) => {
      router.replace(`/s/${code}`);
      if (outcome === "forbidden") setNotice("That link has expired or was already used. Ask the remote for a new one.");
      else if (isFailure(outcome)) setNotice(failureMessage(outcome, "Couldn't move the main screen here. Try the link again."));
      refresh();
    });
  }, [code, takeover, router, refresh, setNotice]);

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

  // Ending a session and playing a picked song cannot be undone, so both ask first (docs/adr/0023).
  const [askingEnd, setAskingEnd] = useState(false);
  const confirmEnd = async () => {
    setAskingEnd(false);
    reportIfFailed(await endSession(code), "Couldn't end the session. Try again.");
    refresh();
  };

  const [pickedId, setPickedId] = useState<string | null>(null);
  const playPicked = async (item: QueueItem, interrupting: QueueItem) => {
    setPickedId(null);
    setLocalPlaying(true);
    const outcome = await playSongNow(code, item.id, interrupting.id);
    // Someone else removed it, or it started meanwhile.
    if (outcome === "not_found") setNotice(`"${displayTitle(item.title)}" isn't waiting any more.`);
    else reportIfFailed(outcome, "Couldn't play that song. Try again.");
    refresh();
  };

  const onFreeRemote = async () => {
    reportIfFailed(await freeRemote(code), "Couldn't free the remote. Try again.");
    refresh();
  };

  const onTakeTurns = async (on: boolean) => {
    reportIfFailed(await setTakeTurns(code, on), "Couldn't change taking turns. Try again.");
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
  const idle = idleNotice({ hasSongs: !!current || queue.length > 0, closesInSeconds: state.closesInSeconds });
  // Only the host edits and adds here: anyone else on this page has no name yet, and goes to the guest screen for one.
  const shownView: RailView = isHost ? railView : "next";
  const duration = progress.duration || current?.durationSeconds || 0;
  const upNext = queue[0];
  const showBanner = upNextBannerVisible({ hasNext: !!upNext, intro, duration: progress.duration, seconds: progress.seconds });
  const showJoinCorner = !!current && (!showQueue || fullscreen);
  // The picked song may be played or removed by someone else while the host decides.
  const picked = pickedId ? queue.find((item) => item.id === pickedId) : undefined;
  // With the mic on, say so, or say what stops it; a test says so in its own panel.
  const micNotice = isHost && mic.settings.isEnabled ? micStatusMessage(mic.status) : "";
  const isMicLive = isHost && mic.settings.isEnabled && mic.status === "live";

  return (
    <div className="flex min-h-dvh flex-col gap-8 p-6 lg:h-dvh lg:flex-row lg:gap-12 lg:px-24 lg:py-[3.375rem]">
      <style>{TV_SCALE}</style>

      {/* Left: video and transport controls */}
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex h-14 shrink-0 items-center gap-6">
          {/* The byline is plain text, not a link: no focus stop that could navigate away mid-party. */}
          <Link href="/" className="rounded-row">
            <Logo mark="h-12 w-12" word="text-[2rem] leading-8" byline={{ text: "by edmel.dev", className: "text-[1.25rem] font-medium leading-6 text-ink-faint" }} />
          </Link>
          {reconnecting ? (
            <span role="status" className="rounded-full bg-notice-ground px-5 py-2 text-[1.25rem] font-semibold text-notice">Reconnecting…</span>
          ) : null}
          <span className="ml-auto" />
          {isMicLive ? (
            <span className="flex items-center gap-2 rounded-full bg-stage-200 px-5 py-2 text-[1.25rem] font-semibold text-spotlight">
              <MicIcon className="h-6 w-6" />
              Mic on
            </span>
          ) : null}
          <SettingsMenu
            isHost={isHost}
            volume={volume}
            onVolume={(next) => {
              setStoredVolume(String(next));
              playerRef.current?.setVolume(next);
            }}
            micStatus={mic.status}
            onMicrophone={() => setShowMic(true)}
            takeTurns={state.takeTurns}
            onTakeTurns={onTakeTurns}
            remote={state.remote}
            remoteName={state.remoteName}
            onFreeRemote={onFreeRemote}
            showQueue={showQueue}
            queueLength={queue.length}
            onToggleQueue={() => setQueueHidden(showQueue ? "1" : null)}
            onEndSession={() => setAskingEnd(true)}
          />
        </header>

        {notice ? (
          <p role="status" className="animate-rise rounded-row bg-notice-ground px-6 py-3 text-[1.5rem] font-semibold text-notice">{notice}</p>
        ) : null}
        {micNotice && !showMic ? (
          <p role="status" className="rounded-row bg-notice-ground px-6 py-3 text-[1.5rem] font-semibold text-notice">{micNotice}</p>
        ) : null}
        {isHost && idle ? (
          <p role="status" className="rounded-row bg-notice-ground px-6 py-3 text-[1.5rem] font-semibold text-notice">{idle}</p>
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

          {showBanner ? <UpNextBanner item={upNext} remainingSeconds={duration - progress.seconds} /> : null}
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
              onPlayPause={() => (intro ? startNow() : setPlaying(!playing))}
              onForward={seekForward}
              onNext={() => current && skip(current.id)}
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
        <div className="flex shrink-0 items-center justify-between gap-4 pl-4 pr-2">
          <h2 className="font-display text-[2.5rem] font-bold leading-[3.25rem] tracking-tight">
            {shownView === "add" ? "Add a song" : "Up next"}
          </h2>
          {shownView === "add" ? (
            <RailButton
              label="Back to Up next"
              onClick={() => {
                chooseRailView("next");
                focusAddButton.current = true;
              }}
            >
              <BackIcon className="h-7 w-7" />
            </RailButton>
          ) : isHost ? (
            <RailButton
              label="Edit queue"
              pressed={shownView === "edit"}
              onClick={() => chooseRailView(shownView === "edit" ? "next" : "edit")}
            >
              {shownView === "edit" ? <CheckIcon className="h-7 w-7" /> : <EditIcon className="h-7 w-7" />}
            </RailButton>
          ) : null}
        </div>

        {/* Rows in the lists bleed past their column; the side padding holds that so no sideways scrollbar appears. */}
        <div
          onKeyDown={keepAddTabOpen}
          onPointerDown={keepAddTabOpen}
          className="-mx-3 flex min-h-64 flex-1 flex-col overflow-y-auto px-3 lg:min-h-0"
        >
          {shownView === "next" ? (
            <UpNextList queue={queue} hasCurrent={!!current} />
          ) : (
            // Phone-sized controls, enlarged a step: these are used up close, not read from the sofa.
            <div className="flex min-h-0 flex-1 flex-col lg:[zoom:1.3]">
              {shownView === "edit" ? (
                <QueuePanel
                  queue={queue}
                  canControl={isHost}
                  onRemove={remove}
                  onMove={move}
                  onPlayNow={current ? (item) => setPickedId(item.id) : undefined}
                  emptyText={current ? "Nothing queued after this song." : "No songs yet. Scan the code to add one."}
                />
              ) : (
                <SearchPanel code={code} name={HOST_SINGER_NAME} showWaitingLimit={false} current={current} queue={queue} played={state.played} autoFocus onAdded={() => {
                    refresh();
                    setBackToUpNext((n) => n + 1);
                  }} />
              )}
            </div>
          )}
        </div>

        {isHost && shownView !== "add" ? (
          <button
            ref={addButtonRef}
            type="button"
            onClick={() => chooseRailView("add")}
            className="flex h-[4.5rem] shrink-0 items-center justify-center gap-3 rounded-full bg-stage-200 text-[1.5rem] font-bold transition hover:bg-stage-300 active:scale-[0.97]"
          >
            <PlusIcon className="h-7 w-7" />
            Add a song
          </button>
        ) : null}

        {current ? <JoinCard {...join} /> : null}
      </aside>

      {picked && current ? (
        <ConfirmDialog
          title="Play this song now?"
          confirmLabel="Play now"
          confirmIcon={<PlayIcon className="h-[1.875rem] w-[1.875rem]" />}
          onConfirm={() => playPicked(picked, current)}
          onCancel={() => setPickedId(null)}
        >
          <div className="flex items-center gap-5 rounded-card bg-stage-200 p-4">
            <Avatar name={picked.addedBy} className="h-16 w-16 text-[1.75rem]" />
            <div className="min-w-0">
              <p className="truncate text-[1.75rem] font-semibold">{displayTitle(picked.title)}</p>
              <p className="mt-0.5 text-[1.5rem] font-medium text-ink-muted">
                {picked.addedBy}{formatDuration(picked.durationSeconds) ? ` · ${formatDuration(picked.durationSeconds)}` : ""}
              </p>
            </div>
          </div>
          <p className="text-[1.75rem] font-medium leading-9 text-ink-muted">
            “{displayTitle(current.title)}” stops now, and {picked.addedBy} is up.
          </p>
        </ConfirmDialog>
      ) : null}

      {showMic && isHost ? (
        <MicrophonePanel
          mic={mic}
          onClose={() => {
            setShowMic(false);
            mic.setTesting(false);
          }}
        />
      ) : null}

      {askingEnd && isHost ? (
        <ConfirmDialog
          title="End the session for everyone?"
          cancelLabel="Keep singing"
          confirmLabel="End session"
          confirmIcon={<PowerIcon className="h-[1.875rem] w-[1.875rem]" />}
          danger
          onConfirm={confirmEnd}
          onCancel={() => setAskingEnd(false)}
        >
          <p className="text-[1.75rem] font-medium leading-9 text-ink-muted">
            The video stops, the queue is cleared, and every phone is told the session has ended. It can&apos;t be reopened.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** The round button beside the queue panel's heading: edit the queue, or go back from search. */
function RailButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full transition active:scale-95 ${
        pressed ? "bg-ink text-stage-000" : "bg-stage-200 text-ink hover:bg-stage-300"
      }`}
    >
      {children}
    </button>
  );
}
