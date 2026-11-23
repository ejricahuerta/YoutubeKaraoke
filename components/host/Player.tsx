"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/client/browser-hooks";
import { resumePosition } from "@/lib/domain/playback";
import { thumbnailUrl, YOUTUBE_PLAYER_HOST } from "@/lib/domain/video";
import { PlayIcon } from "../Icons";

/**
 * The main screen's video: YouTube's IFrame player, in privacy-enhanced mode, with its own
 * controls turned off (docs/adr/0018). Play, pause, seek and volume come from the parent
 * through props and `ref`.
 */

// Minimal typing for the parts of the YouTube IFrame Player API we use.
type YTPlayer = {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  /** Not in YouTube's documented API, so it may be missing. */
  unloadModule?(name: string): void;
  destroy(): void;
};
type YTEvent = { data: number; target: YTPlayer };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      /** The origin the player's iframe is loaded from. */
      host: string;
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: { onReady(e: YTEvent): void; onStateChange(e: YTEvent): void; onApiChange(e: YTEvent): void; onError(e: YTEvent): void };
    },
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const ENDED = 0, PLAYING = 1, PAUSED = 2;
/** Seeking pauses the player for a moment; a pause shorter than this is not reported. */
const PAUSE_SETTLE_MS = 800;
/** If playback has not started this long after loading, the browser blocked autoplay. */
const AUTOPLAY_CHECK_MS = 3000;
const PROGRESS_INTERVAL_MS = 500;
const SAVE_POSITION_INTERVAL_MS = 3000;

/**
 * Karaoke videos have the words on screen already, so captions only cover them. YouTube has
 * no setting for "captions off" (a viewer's own preference can switch them on), so the
 * captions module is unloaded whenever the player may have loaded it.
 */
function hideCaptions(player: YTPlayer) {
  player.unloadModule?.("captions");
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Could not load the YouTube player"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Where to resume this queue item after a page reload (0 = from the start). */
export function savedPosition(itemId: string): number {
  return resumePosition(readStorage(STORAGE_KEYS.position), itemId);
}

export type PlayerHandle = {
  /** Jump forward (positive) or back (negative) by a number of seconds. */
  seekBy(seconds: number): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
};
export type Progress = { seconds: number; duration: number };

export function Player({
  itemId,
  videoId,
  playing,
  volume,
  onEnded,
  onError,
  onPlayingChange,
  onProgress,
  ref,
}: {
  itemId: string;
  videoId: string;
  playing: boolean;
  volume: number;
  onEnded: (itemId: string) => void;
  onError: (itemId: string) => void;
  /** Play or pause requested by clicking the video itself. */
  onPlayingChange: (playing: boolean) => void;
  /** Called a few times a second with the playback position, for our own seek bar. */
  onProgress: (progress: Progress) => void;
  ref?: Ref<PlayerHandle>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  /**
   * Set only once YouTube says the player is ready: before `onReady` the object exists but its
   * methods do not, so anything that finds a player here can call them.
   */
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Latest props for the long-lived player callbacks.
  const latest = useRef({ itemId, playing, volume, onEnded, onError, onPlayingChange, onProgress });
  useEffect(() => {
    latest.current = { itemId, playing, volume, onEnded, onError, onPlayingChange, onProgress };
  });

  useImperativeHandle(ref, () => ({
    seekBy: (delta) => {
      const player = playerRef.current;
      if (!player) return;
      const duration = player.getDuration() || Infinity;
      player.seekTo(Math.max(0, Math.min(duration - 1, player.getCurrentTime() + delta)), true);
    },
    seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    setVolume: (v) => playerRef.current?.setVolume(v),
  }), []);

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    let player: YTPlayer | undefined;
    const el = document.createElement("div");
    mountRef.current?.appendChild(el);

    loadApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(el, {
          // Privacy-enhanced mode: no YouTube cookies before a video plays (docs/adr/0018).
          host: YOUTUBE_PLAYER_HOST,
          width: "100%",
          height: "100%",
          // controls/disablekb/fs off: the app provides its own transport controls.
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerRef.current = e.target;
              e.target.setVolume(latest.current.volume);
              setReady(true);
            },
            onStateChange: (e) => {
              clearTimeout(pauseTimer);
              if (e.data === ENDED) {
                latest.current.onEnded(latest.current.itemId);
              } else if (e.data === PLAYING) {
                hideCaptions(e.target);
                setBlocked(false);
                if (!latest.current.playing) latest.current.onPlayingChange(true);
              } else if (e.data === PAUSED) {
                // Seeking pauses briefly; only report a pause that sticks.
                pauseTimer = setTimeout(() => {
                  if (e.target.getPlayerState() === PAUSED && latest.current.playing) {
                    latest.current.onPlayingChange(false);
                  }
                }, PAUSE_SETTLE_MS);
              }
            },
            // Fires when the player loads a module, captions included.
            onApiChange: (e) => hideCaptions(e.target),
            // 2/5: bad video, 100: removed or private, 101/150: embedding disabled.
            onError: () => latest.current.onError(latest.current.itemId),
          },
        });
      })
      .catch(() => !cancelled && setLoadFailed(true));

    return () => {
      cancelled = true;
      clearTimeout(pauseTimer);
      playerRef.current = null;
      player?.destroy();
      el.remove();
    };
  }, []);

  // Load a video whenever the current queue item changes.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    const opts = { videoId, startSeconds: savedPosition(itemId) };
    if (latest.current.playing) player.loadVideoById(opts);
    else player.cueVideoById(opts);

    // Browsers may refuse to autoplay with sound before any click on the page.
    const check = setTimeout(() => {
      if (latest.current.playing && player.getPlayerState() !== PLAYING) setBlocked(true);
    }, AUTOPLAY_CHECK_MS);
    return () => {
      clearTimeout(check);
      setBlocked(false);
    };
  }, [ready, itemId, videoId]);

  // Follow play / pause from the controls.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    if (playing) player.playVideo();
    else player.pauseVideo();
  }, [ready, playing]);

  // Report the position for the seek bar.
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      latest.current.onProgress({ seconds: player.getCurrentTime() || 0, duration: player.getDuration() || 0 });
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ready]);

  // Remember the position so a page reload resumes the song where it was.
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== PLAYING) return;
      writeStorage(STORAGE_KEYS.position, JSON.stringify({ itemId, seconds: player.getCurrentTime() }));
    }, SAVE_POSITION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [itemId]);

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={mountRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      {/* Covers the video so YouTube's own buttons and links can't be clicked; a click plays or pauses. */}
      {!loadFailed ? (
        <button
          type="button"
          aria-label={playing && !blocked ? "Pause" : "Play"}
          onClick={() => {
            if (blocked) {
              setBlocked(false);
              playerRef.current?.playVideo();
            } else {
              onPlayingChange(!playing);
            }
          }}
          tabIndex={-1}
          className="absolute inset-0 cursor-pointer"
        >
          {/* While paused or waiting to start, show the video's YouTube thumbnail as a poster. */}
          {!playing || blocked ? (
            <span className="absolute inset-0 grid place-items-center bg-black">
              <img
                src={thumbnailUrl(videoId, "poster")}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-50"
              />
              <span className="relative flex items-center gap-4 rounded-full bg-ink px-10 py-5 text-[1.75rem] font-bold text-stage-000 shadow-lift">
                <PlayIcon className="h-9 w-9" /> {blocked ? "Click to start the music" : "Paused"}
              </span>
            </span>
          ) : null}
        </button>
      ) : null}
      {loadFailed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[1.5rem] text-ink-muted">
          The YouTube player couldn&apos;t load. Check this device&apos;s internet connection and reload the page.
        </div>
      ) : null}
    </div>
  );
}
