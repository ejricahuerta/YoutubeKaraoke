"use client";

import { freeRemote, sendPlayback } from "@/lib/client/session-api";
import { failureMessage, isFailure } from "@/lib/domain/messages";
import { playingLabel } from "@/lib/domain/playback";
import type { QueueItem } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { IconButton } from "../IconButton";
import { useState } from "react";
import { CloseIcon, NextIcon, PauseIcon, PlayIcon } from "../Icons";
import { MoveScreenSheet } from "./MoveScreenSheet";

/**
 * Play, pause and skip from the phone, for the first guest who joined (the remote,
 * migration 0010). The video itself keeps playing on the main screen, which follows.
 * The remote can also give the remote up, for another phone to take (migration 0012).
 * While the main screen is away nothing can play, so the buttons wait, and the remote can
 * move the main screen to another device instead (migration 0014).
 */
export function RemoteBar({
  code,
  current,
  isPlaying,
  mainScreenAway,
  onDone,
  onFailed,
}: {
  code: string;
  current: QueueItem | null;
  isPlaying: boolean;
  mainScreenAway: boolean;
  /** Refetch the session after a change. */
  onDone: () => void;
  onFailed: (message: string) => void;
}) {
  const send = async (action: "play" | "pause" | "next") => {
    const outcome = await sendPlayback(code, action, action === "next" ? current?.id : undefined);
    if (isFailure(outcome)) onFailed(failureMessage(outcome, "That didn't reach the main screen. Try again."));
    onDone();
  };

  const [moving, setMoving] = useState(false);

  const giveUp = async () => {
    const outcome = await freeRemote(code);
    if (isFailure(outcome)) onFailed(failureMessage(outcome, "Couldn't give up the remote. Try again."));
    onDone();
  };

  return (
    <div className="mx-2 mb-2 rounded-row bg-stage-100 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-bold uppercase leading-[0.875rem] tracking-[0.1em] text-spotlight">
            You&apos;re the remote{mainScreenAway ? " · Main screen away" : current ? ` · ${playingLabel(isPlaying)}` : ""}
          </p>
          <p className="truncate text-sm font-semibold leading-5">
            {current ? `${current.addedBy} · ${displayTitle(current.title)}` : "Nothing playing yet"}
          </p>
        </div>
        <IconButton label={isPlaying ? "Pause" : "Play"} onClick={() => send(isPlaying ? "pause" : "play")} disabled={!current || mainScreenAway}>
          {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
        </IconButton>
        <IconButton label="Next song" onClick={() => send("next")} disabled={!current || mainScreenAway}>
          <NextIcon className="h-5 w-5" />
        </IconButton>
        <IconButton label="Stop being the remote" onClick={giveUp}>
          <CloseIcon />
        </IconButton>
      </div>
      {mainScreenAway ? (
        <button
          type="button"
          onClick={() => setMoving(true)}
          className="mt-2 h-11 w-full rounded-full bg-stage-300 px-4 text-sm font-semibold transition hover:bg-line active:scale-[0.98]"
        >
          Move the main screen
        </button>
      ) : null}
      <MoveScreenSheet code={code} open={moving} onClose={() => setMoving(false)} />
    </div>
  );
}
