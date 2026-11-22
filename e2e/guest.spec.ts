import { expect, test } from "@playwright/test";
import { CODE, mockSession, PHONE, session, setSingerName, song } from "./session";

test.use({ ...PHONE });

test("a new guest picks a name, searches, adds a song, and can undo it", async ({ page }) => {
  const api = await mockSession(page, session({ queue: [song(3, "Sam", "Mr. Brightside - Karaoke")] }));
  await page.goto(`/join/${CODE}`);

  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await page.getByLabel("Your name").fill("Leo");
  await page.getByRole("button", { name: "Join and pick a song" }).click();

  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  // The server would now report the new song in the queue.
  api.state = session({ queue: [song(3, "Sam", "Mr. Brightside - Karaoke"), { ...song(8, "Leo", "Result song 8 (Karaoke)", true) }] });
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();

  expect(api.sent.at(-1)).toMatchObject({ method: "POST", path: "/queue", body: { videoId: "video000008", name: "Leo" } });
  await expect(page.getByRole("status")).toContainText("Added. You're 2nd");

  await page.getByRole("button", { name: "Undo" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "DELETE", path: `/queue/${song(8, "", "").id}` });
});

test("a guest who is first in line is told to head to the mic", async ({ page }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("button", { name: /My songs · 1/ }).click();
  await expect(page.getByText("You're next.")).toBeVisible();
  await expect(page.getByText("Starts after this song")).toBeVisible();
});

test("a guest can remove their own songs but not other people's", async ({ page }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("button", { name: /Queue · 3/ }).click();
  await expect(page.getByRole("button", { name: /^Remove Dancing Queen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove Mr. Brightside/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
});

test("a failed remove says why", async ({ page }) => {
  const api = await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("button", { name: /My songs/ }).click();
  api.mutationsFail = true;
  await page.getByRole("button", { name: /^Remove Dancing Queen/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "offline" })).toBeVisible();
});

test("a guest who loses the connection keeps the queue and is told it may be stale", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("button", { name: /Queue · 3/ }).click();
  await expect(page.getByText("Mr. Brightside")).toBeVisible();

  api.stateFails = true;
  await page.clock.fastForward(16_000);
  await expect(page.getByText("Reconnecting")).toHaveCount(0); // one missed poll is not worth a notice
  await page.clock.fastForward(16_000);
  await expect(page.getByText("Reconnecting")).toBeVisible();
  await expect(page.getByText("Mr. Brightside")).toBeVisible();

  api.stateFails = false;
  await page.clock.fastForward(16_000);
  await expect(page.getByText("Reconnecting")).toHaveCount(0);
});

test("ended, unknown and malformed sessions each get their own message", async ({ page }) => {
  const api = await mockSession(page, session({ archived: true, current: null, queue: [] }));
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("heading", { name: "This session has ended" })).toBeVisible();

  api.state = null;
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("heading", { name: "Session not found" })).toBeVisible();

  await page.goto("/join/nope");
  await expect(page.getByRole("heading", { name: "That code doesn't look right" })).toBeVisible();
});

test("a phone that opens the main-screen link lands on the guest screen", async ({ page }) => {
  await mockSession(page, session());
  await page.goto(`/s/${CODE}`);
  await expect(page).toHaveURL(`/join/${CODE}`);
});

test("changing your name starts from the old one and can be cancelled", async ({ page }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("button", { name: "Leo, change name" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Leo");
  await page.getByRole("button", { name: "Keep Leo" }).click();
  await expect(page.getByRole("button", { name: "Leo, change name" })).toBeVisible();

  await page.getByRole("button", { name: "Leo, change name" }).click();
  await page.getByLabel("Your name").fill("Leonie");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("button", { name: "Leonie, change name" })).toBeVisible();
});

test("a guest's phone buzzes when their song becomes next, and once only", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const buzzes: unknown[] = [];
    Object.assign(window, { buzzes });
    Object.defineProperty(navigator, "vibrate", { value: (pattern: unknown) => buzzes.push(pattern) });
  });
  const buzzes = () => page.evaluate(() => (window as unknown as { buzzes: unknown[] }).buzzes.length);
  const waiting = [song(3, "Sam", "Mr. Brightside - Karaoke"), song(2, "Leo", "Dancing Queen (Karaoke Version)", true)];
  const api = await mockSession(page, session({ queue: waiting }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("button", { name: /My songs · 1/ }).click();
  await expect(page.getByText("2nd in line")).toBeVisible();
  expect(await buzzes()).toBe(0);

  api.state = session({ current: waiting[0], queue: [waiting[1]] });
  await page.clock.fastForward(16_000);
  await expect(page.getByText("You're next.")).toBeVisible();
  expect(await buzzes()).toBe(1);

  await page.clock.fastForward(16_000); // nothing changed: no second buzz
  expect(await buzzes()).toBe(1);

  api.state = session({ current: waiting[1], queue: [] });
  await page.clock.fastForward(16_000);
  await expect(page.getByText("You're on.")).toBeVisible();
  expect(await buzzes()).toBe(2);
});

test("the queue shows what has been sung tonight, and a song can be added again", async ({ page }) => {
  const sung = song(7, "Zoë", "Wonderwall (Karaoke)");
  const api = await mockSession(page, session({ played: [sung, song(6, "Leo", "Hello (Karaoke)", true)] }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("button", { name: /Queue · 3/ }).click();

  const history = page.getByRole("region", { name: "Sung tonight" });
  await expect(history.getByText("Wonderwall")).toBeVisible();
  await expect(history.getByText("Zoë")).toBeVisible();
  await expect(history.getByText("You")).toBeVisible();

  await history.getByRole("button", { name: "Sing Wonderwall (Karaoke) again" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "POST", path: "/queue", body: { videoId: sung.videoId, name: "Leo" } });
  await expect(page.getByRole("status")).toContainText("Added");
});

test("search marks a song that was already sung tonight", async ({ page }) => {
  await mockSession(page, session({ played: [{ ...song(9, "Zoë", "Result song 9 (Karaoke)") }] }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Sung earlier · Zoë")).toBeVisible();
});

test("a guest with three songs waiting is told before searching, and the server's refusal is explained", async ({ page }) => {
  const mine = [song(2, "Leo", "One", true), song(5, "Leo", "Two", true), song(6, "Leo", "Three", true)];
  const api = await mockSession(page, session({ queue: [song(3, "Sam", "Mr. Brightside - Karaoke"), ...mine] }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByText("You have 3 songs waiting")).toBeVisible();

  api.addAnswer = { status: 409, error: "guest_limit" };
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You already have 3 songs waiting" })).toBeVisible();
});

test("a song that could not be added says so, then the message clears itself", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  api.addAnswer = { status: 500, error: "server_error" };
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  const failed = page.getByRole("alert").filter({ hasText: "Couldn't add that song" });
  await expect(failed).toBeVisible();

  await page.clock.fastForward(7_000);
  await expect(failed).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" })).toBeVisible(); // results stay
});

test("a guest with fewer than three songs waiting sees no limit notice", async ({ page }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText(/songs waiting\. Add more/)).toHaveCount(0);
});

test("guests are warned when the main screen has been closed for a while", async ({ page }) => {
  const api = await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText(/main screen seems to be closed/)).toHaveCount(0);

  api.state = session({ hostAwaySeconds: 300, closesInSeconds: 600 });
  await page.getByRole("button", { name: /Queue · 3/ }).click(); // any refetch will do; focus is one
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("status").filter({ hasText: "main screen seems to be closed" })).toContainText("about 10 min");
});

test("the guest screen breaks none of the Content-Security-Policy", async ({ page }) => {
  const api = await mockSession(page, session({ played: [song(7, "Zoë", "Wonderwall (Karaoke)")] }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Result song 8")).toBeVisible();
  await page.getByRole("button", { name: /Queue · 3/ }).click();
  await page.getByRole("button", { name: /My songs/ }).click();
  expect(api.cspViolations).toEqual([]);
});

test("the Added message and its Undo stay until dismissed", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, session({ queue: [song(3, "Sam", "Mr. Brightside - Karaoke")] }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  api.state = session({ queue: [song(3, "Sam", "Mr. Brightside - Karaoke"), song(8, "Leo", "Result song 8 (Karaoke)", true)] });
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.clock.fastForward(30_000); // no time limit on undoing
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("with only two people singing, there is no song limit", async ({ page }) => {
  const mine = [song(2, "Leo", "One", true), song(5, "Leo", "Two", true), song(6, "Leo", "Three", true)];
  await mockSession(page, session({ queue: mine })); // Maya singing, Leo waiting: two people
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText(/songs waiting\. Add more/)).toHaveCount(0);
});

test("the first guest to join is the remote: play, pause, skip, remove and reorder", async ({ page }) => {
  const api = await mockSession(page, session({ isRemote: true }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await expect(page.getByText("You're the remote")).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "POST", path: "/playback", body: { action: "pause" } });
  await page.getByRole("button", { name: "Next song" }).click();
  expect(api.sent.at(-1)).toMatchObject({ path: "/playback", body: { action: "next", expectedItemId: song(1, "", "").id } });

  await page.getByRole("button", { name: /Queue · 3/ }).click();
  await page.getByRole("button", { name: /^Remove Mr. Brightside/ }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "DELETE", path: `/queue/${song(3, "", "").id}` });
  await page.getByRole("button", { name: "Play Valerie next" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "PATCH", path: `/queue/${song(4, "", "").id}`, body: { afterId: null } });
});

test("other guests get no remote controls", async ({ page }) => {
  await mockSession(page, session({ isRemote: false }));
  await setSingerName(page, "Sam");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText("You're the remote")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next song" })).toHaveCount(0);
});

test("the remote's Play shows Pause while the song plays, and Play once paused", async ({ page }) => {
  const api = await mockSession(page, session({ isRemote: true, isPlaying: false }));
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("button", { name: "Play" }).click();
  expect(api.sent.at(-1)).toMatchObject({ path: "/playback", body: { action: "play" } });
});
