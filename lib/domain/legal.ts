/**
 * Facts the terms, privacy policy and cookie policy (app/(legal)) state about the app.
 * tests/domain/legal.test.ts checks the cookie and storage list against the code that sets
 * them, so adding a cookie or a localStorage key without listing it here fails the tests.
 */

/** Who runs YouOke. Also the credit line on every screen. */
export const OPERATOR = {
  name: "edmel.dev",
  url: "https://edmel.dev",
  email: "me@edmel.dev",
  /** Where tips go, by e-Transfer; shown when a session ends. */
  tipEmail: "pay@edmel.dev",
  location: "Thornhill, Ontario, Canada",
} as const;

/** Shown at the top of each legal page. Change it whenever any of them changes. */
export const LEGAL_UPDATED_ON = "23 November 2026";

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms", title: "Terms of Use" },
  { href: "/privacy", label: "Privacy", title: "Privacy Policy" },
  { href: "/cookies", label: "Cookies", title: "Cookie Policy" },
] as const;

export type BrowserStorageEntry = {
  name: string;
  kind: "cookie" | "local storage";
  purpose: string;
  /** Absent when it stays until the person clears it. */
  lifetimeSeconds?: number;
};

const SECONDS_PER_DAY = 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

/**
 * Everything YouOke itself keeps in the browser. All of it is needed for the app to work,
 * so none of it waits for consent. Names must match lib/server/auth.ts and STORAGE_KEYS.
 */
export const BROWSER_STORAGE: readonly BrowserStorageEntry[] = [
  {
    name: "kg",
    kind: "cookie",
    purpose:
      "A random guest id, so the app knows which songs in the queue you added and lets you remove them, and which sessions this browser started, so it waits 15 minutes after one runs its full hour before starting another.",
    lifetimeSeconds: SECONDS_PER_DAY * DAYS_PER_YEAR,
  },
  {
    name: "kh_<CODE>",
    kind: "cookie",
    purpose: "A random host token for one session, set on the screen that started it, so only that screen can end it and control it.",
    lifetimeSeconds: SECONDS_PER_DAY * 30,
  },
  { name: "karaoke:name", kind: "local storage", purpose: "The singer name you typed, so you don't have to type it again." },
  { name: "karaoke:room", kind: "local storage", purpose: "The code of the session this browser is in, so every tab stays in the same one." },
  { name: "karaoke:volume", kind: "local storage", purpose: "The main screen's volume." },
  { name: "karaoke:queue-hidden", kind: "local storage", purpose: "Whether the main screen's queue panel is hidden." },
  { name: "karaoke:position", kind: "local storage", purpose: "Where the main screen was in the current song, so a reload carries on from there." },
  {
    name: "karaoke:microphone",
    kind: "local storage",
    purpose: "The main screen's microphone settings: whether it is on, which microphone, and its volume, echo and reverb. Never any sound.",
  },
];

/** "30 days", "1 year", or how long an entry with no fixed lifetime lasts. */
export function formatLifetime({ lifetimeSeconds }: Pick<BrowserStorageEntry, "lifetimeSeconds">): string {
  if (lifetimeSeconds === undefined) return "Until you clear your browser's site data";
  const days = Math.round(lifetimeSeconds / SECONDS_PER_DAY);
  if (days % DAYS_PER_YEAR === 0) {
    const years = days / DAYS_PER_YEAR;
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}
