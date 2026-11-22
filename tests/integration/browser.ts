/**
 * A browser for the integration tests: it keeps its own cookies, like a real one, so a
 * test can be a main screen and several phones at once.
 */
import type { SessionState } from "@/lib/domain/types";

const APP_URL = process.env.APP_URL;
if (!APP_URL) throw new Error("APP_URL is not set: run these through npm run test:integration");

const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
export const VIDEO_ID = "dQw4w9WgXcQ";

type Answer = { status: number; body: { ok?: boolean; result?: string; error?: string; code?: string } };

export class Browser {
  private cookies = new Map<string, string>();

  private constructor(private readonly userAgent: string) {}

  static screen() {
    return new Browser(DESKTOP);
  }

  static phone() {
    return new Browser(PHONE);
  }

  async request(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(APP_URL + path, {
      method,
      redirect: "manual",
      headers: {
        "user-agent": this.userAgent,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";");
      const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  private async answer(method: string, path: string, body?: unknown): Promise<Answer> {
    const res = await this.request(method, path, body);
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  /** Starts a session as its main screen; returns its code. */
  async startSession(): Promise<string> {
    const { status, body } = await this.answer("POST", "/api/sessions");
    if (status !== 200 || !body.code) throw new Error(`could not start a session: ${status} ${JSON.stringify(body)}`);
    return body.code;
  }

  async state(code: string): Promise<SessionState> {
    const res = await this.request("GET", `/api/sessions/${code}`);
    if (res.status !== 200) throw new Error(`state ${code}: ${res.status}`);
    return res.json();
  }

  add(code: string, title: string, name: string) {
    return this.answer("POST", `/api/sessions/${code}/queue`, { videoId: VIDEO_ID, title, name, channel: "Test", durationSeconds: 200 });
  }

  remove(code: string, itemId: string) {
    return this.answer("DELETE", `/api/sessions/${code}/queue/${itemId}`);
  }

  move(code: string, itemId: string, afterId: string | null) {
    return this.answer("PATCH", `/api/sessions/${code}/queue/${itemId}`, { afterId });
  }

  playback(code: string, action: "play" | "pause" | "next", expectedItemId?: string) {
    return this.answer("POST", `/api/sessions/${code}/playback`, { action, expectedItemId });
  }

  settings(code: string, settings: Record<string, unknown>) {
    return this.answer("PATCH", `/api/sessions/${code}`, settings);
  }

  end(code: string) {
    return this.answer("DELETE", `/api/sessions/${code}`);
  }
}

/** Titles of the waiting songs, in order. */
export const titles = (state: SessionState) => state.queue.map((item) => item.title).join(",");
/** The id of the song with this title, waiting or current. */
export const idOf = (state: SessionState, title: string) =>
  [state.current, ...state.queue].find((item) => item?.title === title)?.id ?? "";
