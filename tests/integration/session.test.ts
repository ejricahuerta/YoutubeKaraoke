/**
 * A whole night, through the real app and a real database: every route the screens use,
 * with the cookies a main screen and two phones would send. Each step depends on the one
 * before, so they run in order on one session.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Browser, idOf, titles } from "./browser";

const screen = Browser.screen();
const ana = Browser.phone();
const ben = Browser.phone();
const cy = Browser.phone();
let code = "";

beforeAll(async () => {
  code = await screen.startSession();
});

describe("a night of karaoke", () => {
  it("starts a session that its main screen hosts, taking turns by default", async () => {
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    const state = await screen.state(code);
    expect(state).toMatchObject({ isHost: true, isRemote: false, archived: false, takeTurns: true, current: null, queue: [] });
  });

  it("makes the first phone to join the remote, and nobody else", async () => {
    expect((await ana.state(code)).isRemote).toBe(true);
    expect((await ben.state(code)).isRemote).toBe(false);
    expect((await ana.state(code)).isHost).toBe(false);
  });

  it("adds songs: the first starts at once, the rest wait", async () => {
    expect((await ana.add(code, "A1", "Ana")).status).toBe(200);
    expect((await ben.add(code, "B1", "Ben")).status).toBe(200);
    expect((await ben.add(code, "B2", "Ben")).status).toBe(200);
    const state = await ben.state(code);
    expect(state.current).toMatchObject({ title: "A1", addedBy: "Ana", mine: false });
    expect(state.isPlaying).toBe(true);
    expect(titles(state)).toBe("B1,B2");
    expect(state.queue.every((item) => item.mine)).toBe(true);
  });

  it("puts singers in turns once a third person adds a song", async () => {
    expect((await cy.add(code, "C1", "Cy")).status).toBe(200);
    expect(titles(await screen.state(code))).toBe("B1,C1,B2");
  });

  it("lets a guest remove only their own waiting songs", async () => {
    const state = await screen.state(code);
    expect((await cy.remove(code, idOf(state, "B1"))).status).toBe(403);
    expect((await ben.remove(code, idOf(state, "B2"))).status).toBe(200);
    expect(titles(await screen.state(code))).toBe("B1,C1");
  });

  it("lets the main screen and the remote reorder, and nobody else", async () => {
    const state = await screen.state(code);
    expect((await ben.move(code, idOf(state, "C1"), null)).status).toBe(403);
    expect((await ana.move(code, idOf(state, "C1"), null)).status).toBe(200);
    expect(titles(await screen.state(code))).toBe("C1,B1");
    expect((await screen.move(code, idOf(state, "C1"), idOf(state, "B1"))).status).toBe(200);
    expect(titles(await screen.state(code))).toBe("B1,C1");
  });

  it("lets the main screen and the remote pause and play, and nobody else", async () => {
    expect((await ben.playback(code, "pause")).status).toBe(403);
    expect((await ana.playback(code, "pause")).status).toBe(200);
    expect((await screen.state(code)).isPlaying).toBe(false);
    expect((await screen.playback(code, "play")).status).toBe(200);
    expect((await ana.state(code)).isPlaying).toBe(true);
  });

  it("skips once per song, and lets the singer skip their own", async () => {
    const before = await screen.state(code);
    expect((await screen.playback(code, "next", idOf(before, "A1"))).status).toBe(200);
    expect((await screen.playback(code, "next", idOf(before, "A1"))).body.result).toBe("stale");
    const now = await ben.state(code);
    expect(now.current).toMatchObject({ title: "B1", mine: true });
    expect(now.played.map((item) => item.title)).toEqual(["A1"]);

    expect((await cy.playback(code, "next", idOf(now, "B1"))).status).toBe(403);
    expect((await ben.playback(code, "next", idOf(now, "B1"))).status).toBe(200);
    expect((await screen.state(code)).current?.title).toBe("C1");
  });

  it("hands the remote over: freed by the main screen, taken by the first phone to ask", async () => {
    expect(await screen.state(code)).toMatchObject({ remote: "taken", remoteName: "Ana" });
    expect((await ben.freeRemote(code)).status).toBe(403);
    expect((await ben.takeRemote(code)).status).toBe(403);
    expect((await screen.freeRemote(code)).status).toBe(200);
    expect(await ana.state(code)).toMatchObject({ remote: "free", isRemote: false });
    expect((await ben.takeRemote(code)).status).toBe(200);
    expect((await cy.takeRemote(code)).status).toBe(403);
    expect(await ben.state(code)).toMatchObject({ remote: "taken", remoteName: "Ben", isRemote: true });
    expect((await ben.playback(code, "pause")).status).toBe(200);
    expect((await ana.playback(code, "play")).status).toBe(403);
    expect((await ben.playback(code, "play")).status).toBe(200);
  });

  it("lets only the main screen switch taking turns", async () => {
    expect((await ana.settings(code, { takeTurns: false })).status).toBe(403);
    expect((await screen.settings(code, { takeTurns: "no" })).status).toBe(400);
    expect((await screen.settings(code, { takeTurns: false })).status).toBe(200);
    expect((await ben.state(code)).takeTurns).toBe(false);
  });

  it("ends for everyone when the main screen ends it, and only then", async () => {
    expect((await ana.end(code)).status).toBe(403);
    expect((await screen.end(code)).status).toBe(200);
    expect((await ben.state(code)).archived).toBe(true);
    expect((await ben.add(code, "late", "Ben")).status).toBe(410);
  });
});
