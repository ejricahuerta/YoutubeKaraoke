/** Fixtures and network fakes shared by the browser tests. */
import { devices, type Page } from "@playwright/test";
import type { QueueItem, SearchResult, SessionState } from "@/lib/domain/types";

export const CODE = "ABC234";
// An iPhone's screen, touch and user agent, kept in the project's own browser engine.
const { defaultBrowserType: _engine, ...IPHONE } = devices["iPhone 13"];
export const PHONE = IPHONE;

export function song(n: number, addedBy: string, title: string, mine = false): QueueItem {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    videoId: `video00000${n}`,
    title,
    channel: "Sing King",
    thumbnailUrl: "",
    durationSeconds: 200,
    addedBy,
    mine,
  };
}

/** A session with Maya singing and three songs waiting; `overrides` change any part of it. */
export function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    code: CODE,
    archived: false,
    isPlaying: true,
    isHost: false,
    current: song(1, "Maya", "Never Gonna Give You Up (Karaoke)"),
    queue: [song(2, "Leo", "Dancing Queen (Karaoke Version)", true), song(3, "Sam", "Mr. Brightside - Karaoke"), song(4, "Ana", "Valerie")],
    ...overrides,
  };
}

export const SEARCH_RESULTS: SearchResult[] = [8, 9].map((n) => {
  const { videoId, title, channel, thumbnailUrl, durationSeconds } = song(n, "", `Result song ${n} (Karaoke)`);
  return { videoId, title, channel, thumbnailUrl, durationSeconds };
});

export type SentRequest = { method: string; path: string; body: unknown };

/**
 * Answers the app's API from fixtures and blocks YouTube.
 * Returns switches to make calls fail, and the list of changes the page sent.
 */
export async function mockSession(page: Page, state: SessionState | null) {
  const control = { state, stateFails: false, mutationsFail: false, sent: [] as SentRequest[] };
  await page.route(/youtube\.com|ytimg\.com/, (route) => route.abort());
  await page.route(`**/api/sessions/${CODE}`, (route) => {
    if (control.stateFails) return route.abort();
    if (!control.state) return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
    return route.fulfill({ json: control.state });
  });
  await page.route(`**/api/sessions/${CODE}/**`, (route) => {
    const request = route.request();
    control.sent.push({
      method: request.method(),
      path: new URL(request.url()).pathname.replace(`/api/sessions/${CODE}`, ""),
      body: request.postDataJSON(),
    });
    return control.mutationsFail ? route.abort() : route.fulfill({ json: { ok: true, result: "ok" } });
  });
  await page.route("**/api/search**", (route) => route.fulfill({ json: { results: SEARCH_RESULTS } }));
  return control;
}

/** Skips the name form by setting the singer name the way the app stores it. */
export async function setSingerName(page: Page, name: string) {
  await page.addInitScript((value) => window.localStorage.setItem("karaoke:name", value), name);
}
