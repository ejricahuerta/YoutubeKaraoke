"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { STORAGE_KEYS, useExpiringState, useOrigin, useStoredString, useTurnAlert } from "@/lib/client/browser-hooks";
import { addSong, sendPlayback } from "@/lib/client/session-api";
import { useRoom } from "@/lib/client/use-room";
import { useSessionState } from "@/lib/client/use-session-state";
import { countSongs, formatWait } from "@/lib/domain/format";
import { playingLabel } from "@/lib/domain/playback";
import { failureMessage, isFailure, mainScreenGoneNotice } from "@/lib/domain/messages";
import { guestLineup, songOf, turnAlertKey, waitSeconds } from "@/lib/domain/queue";
import type { QueueItem, SearchResult } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { Avatar } from "../Avatar";
import { CenteredMessage, SessionLoadingMessage } from "../CenteredMessage";
import { IconButton } from "../IconButton";
import { InviteIcon, MicIcon, NextIcon, QueueIcon, SearchIcon } from "../Icons";
import { Logo } from "../Logo";
import { QueuePanel } from "../QueuePanel";
import { SearchPanel } from "../SearchPanel";
import { SongRow } from "../SongRow";
import { AddedToast } from "./AddedToast";
import { InviteSheet } from "./InviteSheet";
import { MySongs } from "./MySongs";
import { NameForm } from "./NameForm";
import { OtherRoomMessage } from "./OtherRoomMessage";
import { RemoteBar } from "./RemoteBar";
import { SungTonight } from "./SungTonight";
import { TakeRemoteBar } from "./TakeRemoteBar";
import { isTurnSoon, NextSongCard, TurnBanner } from "./TurnBanner";

type Tab = "search" | "queue" | "mine";
const TAB_TITLES: Record<Tab, string> = { search: "Find a song", queue: "Queue", mine: "My songs" };
const NOTICE_MS = 6000;

/**
 * The phone view (/join/CODE). A browser is in one room at a time (lib/client/use-room):
 * a tab on another room's link asks first, and loads nothing of this room until then,
 * since loading it counts as joining.
 */
export function GuestScreen({ code }: { code: string }) {
  const room = useRoom(code);
  const router = useRouter();
  if (room.status.kind === "checking") return <SessionLoadingMessage status="loading" />;
  if (room.status.kind === "elsewhere") return <OtherRoomMessage room={room.status.room} code={code} onSwitch={room.switchHere} />;
  return (
    <GuestRoom
      code={code}
      onEnded={room.ended}
      onLeave={() => {
        room.leave();
        router.push("/");
      }}
    />
  );
}

/** Pick a name, search, add songs, and watch your place in line. */
function GuestRoom({ code, onEnded, onLeave }: { code: string; onEnded: () => void; onLeave: () => void }) {
  const [notice, setNotice] = useExpiringState<string>(NOTICE_MS);
  const { state, status, reconnecting, refresh, remove, move } = useSessionState(code, setNotice);
  const [name, setName] = useStoredString(STORAGE_KEYS.name);
  const [editingName, setEditingName] = useState(false);
  const [tab, setTab] = useState<Tab>("search");
  const [inviting, setInviting] = useState(false);
  const origin = useOrigin();
  /**
   * Video id of the song this guest just added, while its toast shows. It stays until
   * dismissed or replaced by the next add, so Undo has no time limit (WCAG 2.2.1).
   */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const lineup = guestLineup(state?.current ?? null, state?.queue ?? []);
  const alertKey = turnAlertKey(lineup);
  useTurnAlert(name ? alertKey : null, alertKey?.startsWith("now:") ? "You're on!" : "You're next!");

  const onAdded = useCallback(
    (video: SearchResult) => {
      setJustAdded(video.videoId);
      refresh();
    },
    [refresh, setJustAdded],
  );

  // Whoever added the song being sung may skip it (migration 0010). The remote has its own skip.
  const skipOwnSong = useCallback(
    async (itemId: string) => {
      const outcome = await sendPlayback(code, "next", itemId);
      if (isFailure(outcome)) setNotice(failureMessage(outcome, "Couldn't skip your song. Try again."));
      refresh();
    },
    [code, refresh, setNotice],
  );

  const singAgain = useCallback(
    async (item: QueueItem) => {
      const video = songOf(item);
      const outcome = await addSong(code, video, name ?? "");
      if (outcome === "ok") onAdded(video);
      else setNotice(failureMessage(outcome, "Couldn't add that song. Try again."));
    },
    [code, name, onAdded, setNotice],
  );

  const isOver = status === "archived" || status === "not_found";
  useEffect(() => {
    if (isOver) onEnded();
  }, [isOver, onEnded]);

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
  if (!state || name === undefined) return <SessionLoadingMessage status={status} />;
  if (!name || editingName) {
    return (
      <NameForm
        code={code}
        initialName={name ?? ""}
        onSubmit={(next) => {
          setName(next);
          setEditingName(false);
        }}
        onCancel={name ? () => setEditingName(false) : undefined}
        onLeave={name ? onLeave : undefined}
      />
    );
  }

  const { current, queue } = state;
  const { onNow, queued, next, songCount } = lineup;
  const awayNotice = mainScreenGoneNotice(state);
  const wait = (index: number) => formatWait(waitSeconds(current, queue, index));
  const turnBanner = <TurnBanner onNow={onNow} next={next} hasCurrent={!!current} />;

  const tabs: [Tab, string, ReactNode][] = [
    ["search", "Search", <SearchIcon key="i" />],
    ["queue", `Queue · ${queue.length}`, <QueueIcon key="i" />],
    ["mine", `My songs · ${songCount}`, <MicIcon key="i" className="h-5 w-5" />],
  ];

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo label={TAB_TITLES[tab]} />
        <IconButton label="Invite a friend" onClick={() => setInviting(true)} className="ml-auto">
          <InviteIcon />
        </IconButton>
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label={`${name}, change name`}
          className=" flex h-11 max-w-[45%] shrink-0 items-center gap-2 rounded-full bg-stage-200 pl-1.5 pr-3.5 text-sm font-semibold transition hover:bg-stage-300"
        >
          <Avatar name={name} className="h-8 w-8 text-sm" />
          <span className="truncate">{name}</span>
        </button>
      </header>

      {awayNotice ? (
        <p role="status" className="mx-4 mb-2 rounded-row bg-notice-ground px-4 py-3 text-sm font-semibold text-notice">{awayNotice}</p>
      ) : null}

      {notice ? (
        <p role="alert" className="animate-rise mx-4 mb-2 rounded-row bg-notice-ground px-4 py-3 text-sm font-semibold text-notice">{notice}</p>
      ) : reconnecting ? (
        <p role="status" className="mx-4 mb-2 rounded-row bg-notice-ground px-4 py-3 text-sm font-semibold text-notice">
          Reconnecting… the queue may be out of date.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3">
        {tab === "search" ? (
          <SearchPanel code={code} name={name} current={current} queue={queue} played={state.played} onAdded={onAdded} />
        ) : tab === "queue" ? (
          <>
            {isTurnSoon(onNow, next) ? turnBanner : next ? <NextSongCard next={next} wait={wait(next.index)} /> : null}
            {queue.length > 0 ? (
              <p className="px-1 pb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
                {countSongs(queue.length)} waiting · {wait(queue.length)}
              </p>
            ) : null}
            <div className="-mx-2">
              {current ? <NowRow current={current} playing={state.isPlaying} onSkip={state.isRemote ? undefined : skipOwnSong} /> : null}
              <QueuePanel
                queue={queue}
                canControl={state.isRemote}
                onRemove={remove}
                onMove={state.isRemote ? move : undefined}
                emptyText={current ? "Nothing queued after this song." : "No songs yet. Be the first to add one."}
              />
            </div>
            <SungTonight played={state.played} onSingAgain={singAgain} />
          </>
        ) : (
          <div className="flex flex-col gap-5">
            {turnBanner}
            <MySongs onNow={onNow} queued={queued} wait={wait} onRemove={remove} onFindSong={() => setTab("search")} />
          </div>
        )}
      </div>

      {justAdded ? (
        <AddedToast
          placed={queued.findLast(({ item }) => item.videoId === justAdded)}
          onNow={onNow?.videoId === justAdded}
          wait={wait}
          onUndo={(itemId) => {
            setJustAdded(null);
            remove(itemId);
          }}
          onDismiss={() => setJustAdded(null)}
        />
      ) : null}

      {state.isRemote ? (
        <RemoteBar code={code} current={current} isPlaying={state.isPlaying} onDone={refresh} onFailed={setNotice} />
      ) : state.remote === "free" ? (
        <TakeRemoteBar code={code} onDone={refresh} onFailed={setNotice} />
      ) : current && tab !== "queue" ? (
        <div className="mx-2 mb-2 flex items-center gap-2.5 rounded-row bg-stage-100 px-3 py-2">
          <Avatar name={current.addedBy} className="h-8 w-8 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-bold uppercase leading-[0.875rem] tracking-[0.1em] text-spotlight">
              {playingLabel(state.isPlaying)}
            </p>
            <p className="truncate text-sm font-semibold leading-5">{current.addedBy} · {displayTitle(current.title)}</p>
          </div>
          {current.mine ? <SkipOwnSongButton onSkip={() => skipOwnSong(current.id)} /> : null}
        </div>
      ) : null}

      <InviteSheet code={code} joinUrl={origin ? `${origin}/join/${code}` : ""} open={inviting} onClose={() => setInviting(false)} />

      <nav aria-label="Sections" className="flex border-t border-line bg-stage-100 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "true" : undefined}
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

/** For the singer only: skips the song they added while it is being sung. */
function SkipOwnSongButton({ onSkip }: { onSkip: () => void }) {
  return (
    <IconButton label="Skip your song" onClick={onSkip}>
      <NextIcon className="h-5 w-5" />
    </IconButton>
  );
}

/** The song being sung, at the top of the guest's queue list. `onSkip` is offered only to its singer. */
function NowRow({ current, playing, onSkip }: { current: QueueItem; playing: boolean; onSkip?: (itemId: string) => void }) {
  return (
    <SongRow
      leading={<Avatar name={current.addedBy} />}
      title={displayTitle(current.title)}
      subtitle={
        <>
          <span className="text-spotlight">{playingLabel(playing)}</span> ·{" "}
          {current.mine ? <span className="text-ink">You</span> : current.addedBy}
        </>
      }
      className="mb-0.5 bg-stage-200 pl-3"
      actions={current.mine && onSkip ? <SkipOwnSongButton onSkip={() => onSkip(current.id)} /> : undefined}
    />
  );
}
