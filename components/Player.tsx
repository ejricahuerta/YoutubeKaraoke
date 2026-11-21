"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { readStorage, writeStorage } from "@/lib/browser-hooks";
import { PlayIcon } from "./icons";

// Minimal typing for the parts of the YouTube IFrame Player API we use.
type YTPlayer = {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
};
type YTEvent = { data: number; target: YTPlayer };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: { onReady(e: YTEvent): void; onStateChange(e: YTEvent): void; onError(e: YTEvent): void };
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
const POSITION_KEY = "karaoke:position";

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
function savedPosition(itemId: string): number {
  try {
    const saved = JSON.parse(readStorage(POSITION_KEY) ?? "null");
    return saved?.itemId === itemId && saved.seconds > 5 ? Math.floor(saved.seconds) : 0;
  } catch {
    return 0;
  }
}

export type PlayerHandle = { restart(): void; setVolume(volume: number): void };

export function Player({
  itemId,
  videoId,
  playing,
  volume,
  onEnded,
  onError,
  onPlayingChange,
  ref,
}: {
  itemId: string;
  videoId: string;
  playing: boolean;
  volume: number;
  onEnded: (itemId: string) => void;
  onError: (itemId: string) => void;
  /** The user played or paused using YouTube's own controls inside the video. */
  onPlayingChange: (playing: boolean) => void;
  ref?: Ref<PlayerHandle>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Latest props for the long-lived player callbacks.
  const latest = useRef({ itemId, playing, volume, onEnded, onError, onPlayingChange });
  useEffect(() => {
    latest.current = { itemId, playing, volume, onEnded, onError, onPlayingChange };
  });

  useImperativeHandle(ref, () => ({
    restart: () => playerRef.current?.seekTo(0, true),
    setVolume: (v) => playerRef.current?.setVolume(v),
  }), []);

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    const el = document.createElement("div");
    mountRef.current?.appendChild(el);

    loadApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(el, {
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, iv_load_policy: 3, origin: window.location.origin },
          events: {
            onReady: (e) => {
              e.target.setVolume(latest.current.volume);
              setReady(true);
            },
            onStateChange: (e) => {
              clearTimeout(pauseTimer);
              if (e.data === ENDED) {
                latest.current.onEnded(latest.current.itemId);
              } else if (e.data === PLAYING) {
                setBlocked(false);
                if (!latest.current.playing) latest.current.onPlayingChange(true);
              } else if (e.data === PAUSED) {
                // Seeking pauses briefly; only report a pause that sticks.
                pauseTimer = setTimeout(() => {
                  if (e.target.getPlayerState() === PAUSED && latest.current.playing) {
                    latest.current.onPlayingChange(false);
                  }
                }, 800);
              }
            },
            // 2/5: bad video, 100: removed or private, 101/150: embedding disabled.
            onError: () => latest.current.onError(latest.current.itemId),
          },
        });
      })
      .catch(() => !cancelled && setLoadFailed(true));

    return () => {
      cancelled = true;
      clearTimeout(pauseTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
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
    }, 3000);
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

  // Remember the position so a page reload resumes the song where it was.
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player || player.getPlayerState() !== PLAYING) return;
      writeStorage(POSITION_KEY, JSON.stringify({ itemId, seconds: player.getCurrentTime() }));
    }, 3000);
    return () => clearInterval(timer);
  }, [itemId]);

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={mountRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      {loadFailed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-300">
          The YouTube player couldn&apos;t load. Check this device&apos;s internet connection and reload the page.
        </div>
      ) : null}
      {blocked && !loadFailed ? (
        <button
          type="button"
          onClick={() => {
            setBlocked(false);
            playerRef.current?.playVideo();
          }}
          className="absolute inset-0 grid place-items-center bg-black/70 text-white"
        >
          <span className="flex items-center gap-3 rounded-full bg-rose-600 px-6 py-3 text-lg font-semibold">
            <PlayIcon /> Click to start the music
          </span>
        </button>
      ) : null}
    </div>
  );
}
