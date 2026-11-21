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
