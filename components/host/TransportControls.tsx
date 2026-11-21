import { formatDuration } from "@/lib/domain/format";
import { IconButton } from "../IconButton";
import { Forward10Icon, FullscreenIcon, NextIcon, PauseIcon, PlayIcon, VolumeIcon } from "../Icons";

const BIG_ICON = "h-12 w-12";

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

/** The host's buttons: play or pause, forward, next, volume and full screen, sized for a TV. */
export function TransportControls({
  hasCurrent,
  intro,
  playing,
  volume,
  onPlayPause,
  onForward,
  onNext,
  onVolume,
  onFullscreen,
}: {
  hasCurrent: boolean;
  /** The "you're up" call-out is showing, so the big button starts the song. */
  intro: boolean;
  playing: boolean;
  volume: number;
  onPlayPause: () => void;
  onForward: () => void;
  onNext: () => void;
  onVolume: (volume: number) => void;
  onFullscreen: () => void;
}) {
  const playLabel = intro ? "Start now" : playing ? "Pause" : "Play";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={playLabel}
        title={playLabel}
        disabled={!hasCurrent}
        onClick={onPlayPause}
        autoFocus
        className="mr-4 grid h-[7.5rem] w-[7.5rem] place-items-center rounded-full bg-ink text-stage-000 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
      >
        {playing && hasCurrent && !intro ? <PauseIcon className="h-14 w-14" /> : <PlayIcon className="h-14 w-14" />}
      </button>
      <IconButton size="lg" label="Forward 10 seconds" onClick={onForward} disabled={!hasCurrent || intro}>
        <Forward10Icon className={BIG_ICON} />
      </IconButton>
      <IconButton size="lg" label="Next song" onClick={onNext} disabled={!hasCurrent}>
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
          onChange={(e) => onVolume(Number(e.target.value))}
          className="h-2.5 w-28 cursor-pointer accent-ink"
        />
      </label>
      <IconButton size="lg" label="Full screen" disabled={!hasCurrent} onClick={onFullscreen}>
        <FullscreenIcon className="h-11 w-11" />
      </IconButton>
    </div>
  );
}
