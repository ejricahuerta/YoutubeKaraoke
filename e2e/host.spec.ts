import { expect, test } from "@playwright/test";
import { CODE, mockSession, session, song } from "./session";

const hosting = (overrides = {}) => session({ isHost: true, queue: [song(2, "Leo", "Song B"), song(3, "Sam", "Song C"), song(4, "Ana", "Song D")], ...overrides });

test("before the first song the main screen shows how to join", async ({ page }) => {
  await mockSession(page, hosting({ current: null, queue: [] }));
  await page.goto(`/s/${CODE}`);

  await expect(page.getByRole("heading", { name: "Scan. Pick. Sing." })).toBeVisible();
  await expect(page.getByText(CODE).first()).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code to join this karaoke session" }).first()).toBeVisible();
});

test("each song starts with the singer's call-out, and Start now brings up the controls", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  await expect(page.getByRole("heading", { name: "Maya, you're up!" })).toBeVisible();
  await page.getByRole("button", { name: "Start now" }).first().click();

  await expect(page.getByRole("heading", { name: "Maya, you're up!" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Song position" })).toBeVisible();
  expect(api.sent.at(-1)).toMatchObject({ method: "POST", path: "/playback", body: { action: "play" } });
});

test("Next song names the song the host believes is playing", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();

  await page.getByRole("button", { name: "Next song" }).click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ path: "/playback", body: { action: "next", expectedItemId: song(1, "", "").id } });
});

test("the host reorders the queue with Move, without dragging", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Edit queue" }).click();

  await page.getByRole("button", { name: "Move Song D", exact: true }).click();
  await page.getByRole("button", { name: "Move here, to place 1" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "PATCH", path: `/queue/${song(4, "", "").id}`, body: { afterId: null } });

  await page.getByRole("button", { name: "Move Song B", exact: true }).click();
  await page.getByRole("button", { name: "Move here, to place 3" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "PATCH", path: `/queue/${song(2, "", "").id}`, body: { afterId: song(4, "", "").id } });

  const sent = api.sent.length;
  await page.getByRole("button", { name: "Move Song C", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Cancel move" })).toHaveCount(0);
  expect(api.sent).toHaveLength(sent);
});

test("the host can remove anyone's song", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Edit queue" }).click();
  await expect(page.getByRole("button", { name: "Edit queue" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Remove Song C" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "DELETE", path: `/queue/${song(3, "", "").id}` });

  await page.getByRole("button", { name: "Edit queue" }).click();
  await expect(page.getByRole("button", { name: "Remove Song C" })).toHaveCount(0);
});

test("Play now asks first, then plays the picked song in place of the current one", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Edit queue" }).click();

  await page.getByRole("button", { name: "Play Song D now" }).click();
  const dialog = page.getByRole("dialog", { name: "Play this song now?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Song D");
  await expect(dialog).toContainText("stops now, and Ana is up.");
  // A second press on a remote lands on Cancel, never on Play now.
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  expect(api.sent).toHaveLength(0);

  await page.getByRole("button", { name: "Play Song D now" }).click();
  await dialog.getByRole("button", { name: "Play now" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({
    method: "POST",
    path: `/queue/${song(4, "", "").id}`,
    body: { expectedItemId: song(1, "", "").id },
  });
});

test("Escape closes the Play now question without playing anything", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Edit queue" }).click();
  await page.getByRole("button", { name: "Play Song C now" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.sent).toHaveLength(0);
});

test("under the video the host has four buttons of one size", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();

  const names = ["Pause", "Forward 10 seconds", "Next song", "Full screen"];
  const sizes = await Promise.all(names.map((name) => page.getByRole("button", { name, exact: true }).boundingBox()));
  for (const size of sizes) expect(size).toMatchObject({ width: sizes[0]!.width, height: sizes[0]!.height });
  await expect(page.getByRole("slider", { name: "Volume" })).toBeHidden();
});

test("hiding the queue moves the QR code to a corner of the video, and the choice survives a reload", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  const qrCodes = page.getByRole("img", { name: "QR code to join this karaoke session" });
  await expect(qrCodes).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Hide queue" }).click();
  await expect(page.getByRole("heading", { name: "Up next" })).toBeHidden();
  await expect(qrCodes.first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Show queue (3)" })).toBeVisible();
});

test("a failed action says why, and the notice clears itself", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Edit queue" }).click();

  api.mutationsFail = true;
  await page.getByRole("button", { name: "Remove Song C" }).click();
  await expect(page.getByRole("status").filter({ hasText: "offline" })).toBeVisible();
  await page.clock.fastForward(7_000);
  await expect(page.getByRole("status").filter({ hasText: "offline" })).toHaveCount(0);
});

test("the main screen adds for everyone, so it is not held to the three-song limit", async ({ page }) => {
  const mine = [song(2, "Host", "One", true), song(3, "Host", "Two", true), song(4, "Host", "Three", true)];
  const api = await mockSession(page, hosting({ queue: [song(5, "Leo", "Song E"), song(6, "Sam", "Song F"), ...mine] }));
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Add a song" }).click();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText(/songs waiting/)).toHaveCount(0);

  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  await expect(page.getByRole("button", { name: "Added Result song 8 (Karaoke)" })).toBeVisible();
  expect(api.sent.at(-1)).toMatchObject({ method: "POST", path: "/queue", body: { videoId: "video000008", name: "Host" } });
});

test("a second computer on the main-screen link watches but cannot add songs as the host", async ({ page }) => {
  await mockSession(page, session());
  await page.goto(`/s/${CODE}`);

  await expect(page.getByText("The video plays on the screen that started this session.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a song" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add songs from this device" })).toHaveAttribute("href", `/join/${CODE}`);
  await expect(page.getByRole("button", { name: "Next song" })).toHaveCount(0);
});

test("an ended session offers a way to start a new one", async ({ page }) => {
  await mockSession(page, session({ archived: true, current: null, queue: [] }));
  await page.goto(`/s/${CODE}`);
  await expect(page.getByRole("heading", { name: "This session has ended" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new session" })).toHaveAttribute("href", "/");
});

test("the Settings menu works from a remote: arrows move through it and Escape closes it", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  const settings = page.getByRole("button", { name: "Settings" });
  await settings.click();
  await expect(settings).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("slider", { name: "Volume" })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: /^Microphone/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("switch", { name: "Take turns" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Free the remote" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Hide queue" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "End session" })).toBeFocused();
  await page.keyboard.press("ArrowDown"); // wraps round to the top
  await expect(page.getByRole("slider", { name: "Volume" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("switch", { name: "Take turns" })).toBeHidden();
  await expect(settings).toBeFocused();
});

test("a press outside the Settings menu closes it", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Up next" }).click();
  await expect(page.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-expanded", "false");
});

test("End session asks first, and everyone is told it ended", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  const dialog = page.getByRole("dialog", { name: "End the session for everyone?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep singing" })).toBeFocused();
  expect(api.sent).toHaveLength(0); // opening the question sends nothing

  api.state = session({ isHost: true, archived: true, current: null, queue: [] });
  await dialog.getByRole("button", { name: "End session" }).click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ method: "DELETE", path: "" });
  await expect(page.getByRole("heading", { name: "This session has ended" })).toBeVisible();
});

test("Keep singing closes the End session question and ends nothing", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByRole("button", { name: "Keep singing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.sent).toHaveLength(0);
});

test("the host can switch taking turns off and on", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();

  const toggle = page.getByRole("switch", { name: "Take turns" });
  await expect(toggle).toBeChecked();
  // The page refetches right after the change, so the fake answers with the new setting first.
  api.state = hosting({ takeTurns: false });
  await toggle.click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ method: "PATCH", path: "", body: { takeTurns: false } });
  await expect(toggle).not.toBeChecked();

  api.state = hosting({ takeTurns: true });
  await toggle.click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ method: "PATCH", body: { takeTurns: true } });
  await expect(toggle).toBeChecked();
});

test("the main screen shows who has the remote, and can free it", async ({ page }) => {
  const api = await mockSession(page, hosting({ remote: "taken", remoteName: "Ana" }));
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();

  await expect(page.getByText("Remote: Ana")).toBeVisible();
  api.state = hosting({ remote: "free", remoteName: null });
  await page.getByRole("button", { name: "Free the remote" }).click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ method: "DELETE", path: "/remote" });
  await expect(page.getByText("Remote: free, any phone can take it")).toBeVisible();
  await expect(page.getByRole("button", { name: "Free the remote" })).toHaveCount(0);
});

test("the main screen says who will get the remote before anyone has it", async ({ page }) => {
  await mockSession(page, hosting({ remote: "unclaimed", remoteName: null }));
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Remote: first phone to join")).toBeVisible();
});

test("a remote with no songs yet is still shown", async ({ page }) => {
  await mockSession(page, hosting({ remote: "taken", remoteName: null }));
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Remote: a phone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Free the remote" })).toBeVisible();
});

test("another computer's Settings only hides the queue: no volume, microphone, turns or End session", async ({ page }) => {
  await mockSession(page, session());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Hide queue" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Volume" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Microphone/ })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Take turns" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End session" })).toHaveCount(0);
});

test("the main screen breaks none of the Content-Security-Policy", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit queue" }).click();
  await page.getByRole("button", { name: "Play Song C now" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Edit queue" }).click();
  await page.getByRole("button", { name: "Add a song" }).click();
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Result song 8")).toBeVisible();
  expect(api.cspViolations).toEqual([]);
});

test("30 seconds after the host adds a song, the panel goes back to Up next", async ({ page }) => {
  await page.clock.install();
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Add a song" }).click();
  await page.getByRole("searchbox").fill("queen");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  await expect(page.getByRole("button", { name: "Added Result song 8 (Karaoke)" })).toBeVisible();

  // Still searching: typing puts the switch off again.
  await page.clock.fastForward(20_000);
  await page.getByRole("searchbox").press("End");
  await page.clock.fastForward(20_000);
  await expect(page.getByRole("searchbox")).toBeVisible();

  await page.clock.fastForward(11_000);
  await expect(page.getByRole("heading", { name: "Up next" })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});

test("Back to Up next leaves search straight away", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Add a song" }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("button", { name: "Back to Up next" }).click();
  await expect(page.getByRole("heading", { name: "Up next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a song" })).toBeFocused();
});

test("without adding a song, search stays open", async ({ page }) => {
  await page.clock.install();
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Add a song" }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("searchbox")).toBeVisible();
});

test("the main screen follows a pause from the phone remote", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();
  await expect(page.getByRole("button", { name: "Pause" }).first()).toBeVisible();

  api.state = hosting({ isPlaying: false }); // the remote paused
  await page.clock.fastForward(16_000);
  await expect(page.getByRole("button", { name: "Play", exact: true }).first()).toBeVisible();

  api.state = hosting({ isPlaying: true }); // and played again
  await page.clock.fastForward(16_000);
  await expect(page.getByRole("button", { name: "Pause" }).first()).toBeVisible();
});

test("the main screen asks YouTube for its privacy-enhanced player, with YouTube's own controls off", async ({ page }) => {
  await mockSession(page, hosting());
  // A stand-in for YouTube's IFrame API that records how the page creates the player.
  await page.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.YT = { Player: function (el, options) { window.playerOptions = options; return {
        loadVideoById() {}, cueVideoById() {}, playVideo() {}, pauseVideo() {}, seekTo() {}, setVolume() {},
        getCurrentTime() { return 0; }, getDuration() { return 0; }, getPlayerState() { return -1; }, destroy() {},
      }; } }; window.onYouTubeIframeAPIReady();`,
    }),
  );
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();

  const options = await page.waitForFunction(() => (window as unknown as { playerOptions?: unknown }).playerOptions).then((h) => h.jsonValue());
  expect(options).toMatchObject({
    host: "https://www.youtube-nocookie.com",
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0 },
  });
});

test("the main screen waits for YouTube's player to be ready before asking where the song is", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await mockSession(page, hosting());
  // Like YouTube's real IFrame API, this player has no methods until just before onReady.
  await page.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.YT = { Player: function (el, options) { const player = this; window.finishLoadingPlayer = () => {
        Object.assign(player, {
          loadVideoById() {}, cueVideoById() {}, playVideo() {}, pauseVideo() {}, seekTo() {}, setVolume() {},
          getCurrentTime() { return 42; }, getDuration() { return 180; }, getPlayerState() { return 1; }, destroy() {},
        });
        options.events.onReady({ data: 0, target: player });
      }; } }; window.onYouTubeIframeAPIReady();`,
    }),
  );
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();
  await page.waitForFunction(() => "finishLoadingPlayer" in window);

  // Still loading: several rounds of saving the position pass without an error.
  await page.clock.fastForward(10_000);
  expect(errors).toEqual([]);

  // Once ready, the position is saved so a reload resumes the song.
  await page.evaluate(() => (window as unknown as { finishLoadingPlayer(): void }).finishLoadingPlayer());
  await page.clock.fastForward(4_000);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("karaoke:position"))).toContain('"seconds":42');
  expect(errors).toEqual([]);
});

test("opening a move-the-main-screen link makes this screen the main screen", async ({ page }) => {
  const LINK_SECRET = "s".repeat(43);
  const api = await mockSession(page, session({ isHost: false }));
  await page.goto(`/s/${CODE}?takeover=${LINK_SECRET}`);

  await expect.poll(() => api.sent.find((request) => request.path === "/host")).toMatchObject({ method: "POST", body: { token: LINK_SECRET } });
  await expect(page).toHaveURL(new RegExp(`/s/${CODE}$`));
});

test("a used or expired link says so", async ({ page }) => {
  await mockSession(page, session({ isHost: false }));
  await page.route(`**/api/sessions/${CODE}/host`, (route) => route.fulfill({ status: 403, json: { ok: false, error: "forbidden" } }));
  await page.goto(`/s/${CODE}?takeover=${"s".repeat(43)}`);
  await expect(page.getByText("That link has expired or was already used. Ask the remote for a new one.")).toBeVisible();
});

test("an idle session warns the main screen before it ends", async ({ page }) => {
  await mockSession(page, hosting({ current: null, queue: [], closesInSeconds: 300 }));
  await page.goto(`/s/${CODE}`);
  await expect(page.getByText("Nothing's queued. This session ends in about 5 min unless someone adds a song.")).toBeVisible();
});

test("the main screen is warned before the session's hour is up, instead of being told to add a song", async ({ page }) => {
  await mockSession(page, hosting({ current: null, queue: [], closesInSeconds: 240, limitInSeconds: 240 }));
  await page.goto(`/s/${CODE}`);
  await expect(page.getByRole("status").filter({ hasText: "Sessions last an hour at most, so this one ends in about 4 min." })).toBeVisible();
  await expect(page.getByText(/unless someone adds a song/)).toHaveCount(0);
});

test("an ended session says it may have reached its hour", async ({ page }) => {
  await mockSession(page, hosting({ archived: true, current: null, queue: [], closesInSeconds: null, limitInSeconds: null }));
  await page.goto(`/s/${CODE}`);
  await expect(page.getByText(/or reached its one-hour limit/)).toBeVisible();
});

