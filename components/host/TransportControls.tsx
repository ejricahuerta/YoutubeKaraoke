import type { ReactNode } from "react";
import { formatDuration } from "@/lib/domain/format";
import { Forward10Icon, FullscreenIcon, NextIcon, PauseIcon, PlayIcon } from "../Icons";

const ICON = "h-14 w-14";

/** Position in the song, with a slider to move through it. */
export function SeekBar({ seconds, duration, onSeek }: { seconds: number; duration: number; onSeek: (seconds: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-5 text-[1.5rem] font-semibold tabular-nums text-ink-muted">
      <span className="w-16 text-right">{formatDuration(seconds) || "0:00"}</span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(duration))}
        value={Math.floor(seconds)}
        aria-label="Song position"
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-2.5 min-w-0 flex-1 cursor-pointer accent-spotlight"
      />
      <span className="w-16">{formatDuration(duration)}</span>
    </div>
  );
}

/** The four buttons under the video, one size, icons only, readable from the sofa (docs/adr/0019). */
export function TransportControls({
  hasCurrent,
  intro,
  playing,
  onPlayPause,
  onForward,
  onNext,
  onFullscreen,
}: {
  hasCurrent: boolean;
  /** The "you're up" call-out is showing, so the play button starts the song. */
  intro: boolean;
  playing: boolean;
  onPlayPause: () => void;
  onForward: () => void;
  onNext: () => void;
  onFullscreen: () => void;
}) {
  const playLabel = intro ? "Start now" : playing ? "Pause" : "Play";
  return (
    <div className="flex items-center gap-6">
      {/* Focused first, so a remote's OK button plays and pauses. */}
      <RoundButton label={playLabel} onClick={onPlayPause} disabled={!hasCurrent} autoFocus className="bg-ink text-stage-000">
        {playing && hasCurrent && !intro ? <PauseIcon className={ICON} /> : <PlayIcon className={ICON} />}
      </RoundButton>
      <RoundButton label="Forward 10 seconds" onClick={onForward} disabled={!hasCurrent || intro} className="bg-stage-200 text-ink hover:bg-stage-300">
        <Forward10Icon className={ICON} />
      </RoundButton>
      <RoundButton label="Next song" onClick={onNext} disabled={!hasCurrent} className="bg-encore text-on-encore hover:bg-encore-hover">
        <NextIcon className="h-[3.25rem] w-[3.25rem]" />
      </RoundButton>
      <RoundButton label="Full screen" onClick={onFullscreen} disabled={!hasCurrent} className="bg-stage-200 text-ink hover:bg-stage-300">
        <FullscreenIcon className="h-[3.125rem] w-[3.125rem]" />
      </RoundButton>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  autoFocus,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  autoFocus?: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`grid h-[7.5rem] w-[7.5rem] shrink-0 place-items-center rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}
