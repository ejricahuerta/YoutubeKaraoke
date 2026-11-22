"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { fetchRecentSongs } from "@/lib/client/session-api";
import type { RecentSong } from "@/lib/domain/types";
import { displayTitle } from "@/lib/domain/video";
import { NoteIcon } from "./Icons";

/** A new song goes up this often. */
const LAUNCH_EVERY_MS = 1400;
/** How many can be in the air at once; older ones are dropped if a background tab stops ending them. */
const MAX_IN_FLIGHT = 8;
/** Shown, still, to people who asked for less motion. */
const STILL_COUNT = 5;

const SPARK_COLORS = ["var(--color-encore)", "var(--color-spotlight)", "var(--color-aqua)", "var(--color-singer-6)"];
const SPARK_COUNT = 14;
const SPARK_RADIUS_REM = 4;

/** One ring of dots drawn as box-shadows on a single element, so a burst costs one node. */
const SPARK_RINGS = SPARK_COLORS.map((color, ring) =>
  Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = ((i + ring / SPARK_COLORS.length) / SPARK_COUNT) * 2 * Math.PI;
    const radius = SPARK_RADIUS_REM * (i % 2 ? 0.72 : 1);
    const dot = i % 3 ? color : "var(--color-ink)";
    return `${(Math.cos(angle) * radius).toFixed(2)}rem ${(Math.sin(angle) * radius).toFixed(2)}rem 0.1rem 0.08rem ${dot}`;
  }).join(", "),
);

type Launch = { key: number; song: RecentSong };

/**
 * Where the nth launch goes up: spread across the column without two in a row landing
 * together, and a little drift so the paths are not straight lines.
 */
function launchStyle(n: number): CSSProperties {
  return {
    left: `${15 + ((n * 37) % 70)}%`,
    "--rise": `${22 + ((n * 7) % 5) * 3.5}rem`,
    "--drift": `${((n * 5) % 7) - 3}rem`,
    "--spark": SPARK_COLORS[n % SPARK_COLORS.length],
  } as CSSProperties;
}

/**
 * Songs sung lately in any session (docs/adr/0021), going up behind the start page's cards
 * and bursting like fireworks. Screen readers get them as a plain list; the motion is decoration.
 */
export function RecentSongs() {
  const [songs, setSongs] = useState<RecentSong[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRecentSongs().then((found) => {
      if (!cancelled) setSongs(found);
    });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    update();
    query.addEventListener("change", update);
    return () => {
      cancelled = true;
      query.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (songs.length === 0 || still) return;
    let n = 0;
    const launch = () => {
      const key = n++;
      setLaunches((flying) => [...flying, { key, song: songs[key % songs.length] }].slice(-MAX_IN_FLIGHT));
    };
    launch();
    const timer = setInterval(launch, LAUNCH_EVERY_MS);
    return () => {
      clearInterval(timer);
      setLaunches([]);
    };
  }, [songs, still]);

  if (songs.length === 0) return null;
  const land = (key: number) => setLaunches((flying) => flying.filter((l) => l.key !== key));

  return (
    <>
      <h2 id="sung-lately" className="sr-only">Sung lately</h2>
      <ul aria-labelledby="sung-lately" className="sr-only">
        {songs.map((song) => (
          <li key={song.videoId}>{displayTitle(song.title)}</li>
        ))}
      </ul>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[min(80vh,40rem)]">
        {still
          ? songs.slice(0, STILL_COUNT).map((song, n) => (
              <div key={song.videoId} className="firework-still absolute bottom-0" style={launchStyle(n)}>
                <SongName song={song} />
              </div>
            ))
          : launches.map(({ key, song }) => (
              <div key={key} className="firework absolute top-full" style={launchStyle(key)} onAnimationEnd={(e) => e.target === e.currentTarget && land(key)}>
                <span className="firework-burst" style={{ boxShadow: SPARK_RINGS[key % SPARK_RINGS.length] }} />
                <SongName song={song} />
              </div>
            ))}
      </div>
    </>
  );
}

/** A note in the launch's colour, then the song's name. */
function SongName({ song }: { song: RecentSong }) {
  return (
    <p className="flex max-w-[16rem] items-center gap-2 whitespace-nowrap text-base font-semibold text-ink">
      <NoteIcon className="h-6 w-6 shrink-0 text-[var(--spark)] drop-shadow-[0_0_0.5rem_var(--spark)]" />
      <span className="truncate">{displayTitle(song.title)}</span>
    </p>
  );
}
