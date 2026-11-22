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
  await page.getByRole("tab", { name: "Edit queue" }).click();

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

test("Play next sends a song to the top, and the host can remove anyone's song", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("tab", { name: "Edit queue" }).click();

  await page.getByRole("button", { name: "Play Song D next" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "PATCH", body: { afterId: null } });
  await page.getByRole("button", { name: "Remove Song C" }).click();
  expect(api.sent.at(-1)).toMatchObject({ method: "DELETE", path: `/queue/${song(3, "", "").id}` });
});

test("hiding the queue moves the QR code to a corner of the video, and the choice survives a reload", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  const qrCodes = page.getByRole("img", { name: "QR code to join this karaoke session" });
  await expect(qrCodes).toHaveCount(1);

  await page.getByRole("button", { name: "Hide queue" }).click();
  await expect(page.getByRole("tab", { name: "Up next" })).toBeHidden();
  await expect(qrCodes.first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Show queue (3)" })).toBeVisible();
});

test("a failed action says why, and the notice clears itself", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("tab", { name: "Edit queue" }).click();

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
  await page.getByRole("tab", { name: "Add a song" }).click();
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
  await expect(page.getByRole("tab", { name: "Add a song" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add songs from this device" })).toHaveAttribute("href", `/join/${CODE}`);
  await expect(page.getByRole("button", { name: "Next song" })).toHaveCount(0);
});

test("an ended session offers a way to start a new one", async ({ page }) => {
  await mockSession(page, session({ archived: true, current: null, queue: [] }));
  await page.goto(`/s/${CODE}`);
  await expect(page.getByRole("heading", { name: "This session has ended" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a new session" })).toHaveAttribute("href", "/");
});

test("the queue panel's tabs work from the keyboard and name their panel", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveAccessibleName("Up next");

  await page.getByRole("tab", { name: "Up next" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Edit queue" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Edit queue" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toHaveAccessibleName("Edit queue");
  await expect(page.getByRole("button", { name: "Remove Song C" })).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft"); // wraps round to the last tab
  await expect(page.getByRole("tab", { name: "Add a song" })).toBeFocused();
});

test("the host ends the session with two presses, and everyone is told it ended", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  await page.getByRole("button", { name: "End session" }).click();
  expect(api.sent.filter((request) => request.method === "DELETE")).toHaveLength(0); // one press is never enough

  api.state = session({ isHost: true, archived: true, current: null, queue: [] });
  await page.getByRole("button", { name: "End for everyone?" }).click();
  await expect.poll(() => api.sent.at(-1)).toMatchObject({ method: "DELETE", path: "" });
  await expect(page.getByRole("heading", { name: "This session has ended" })).toBeVisible();
});

test("an unconfirmed End session goes back to normal by itself", async ({ page }) => {
  await page.clock.install();
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);

  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("button", { name: "End for everyone?" })).toBeVisible();
  await page.clock.fastForward(6_000);
  await expect(page.getByRole("button", { name: "End session" })).toBeVisible();
  expect(api.sent).toHaveLength(0);
});

test("only the host is offered End session", async ({ page }) => {
  await mockSession(page, session());
  await page.goto(`/s/${CODE}`);
  await expect(page.getByRole("button", { name: "Hide queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "End session" })).toHaveCount(0);
});

test("the main screen breaks none of the Content-Security-Policy", async ({ page }) => {
  const api = await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("button", { name: "Start now" }).first().click();
  await page.getByRole("tab", { name: "Edit queue" }).click();
  await page.getByRole("tab", { name: "Add a song" }).click();
  await page.getByRole("searchbox").fill("abba");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Result song 8")).toBeVisible();
  expect(api.cspViolations).toEqual([]);
});

test("30 seconds after the host adds a song, the panel goes back to Up next", async ({ page }) => {
  await page.clock.install();
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("tab", { name: "Add a song" }).click();
  await page.getByRole("searchbox").fill("queen");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Add Result song 8 (Karaoke) to the queue" }).click();
  await expect(page.getByRole("button", { name: "Added Result song 8 (Karaoke)" })).toBeVisible();

  // Still searching: typing puts the switch off again.
  await page.clock.fastForward(20_000);
  await page.getByRole("searchbox").press("End");
  await page.clock.fastForward(20_000);
  await expect(page.getByRole("tab", { name: "Add a song" })).toHaveAttribute("aria-selected", "true");

  await page.clock.fastForward(11_000);
  await expect(page.getByRole("tab", { name: "Up next" })).toHaveAttribute("aria-selected", "true");
});

test("without adding a song, the Add a song tab stays open", async ({ page }) => {
  await page.clock.install();
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await page.getByRole("tab", { name: "Add a song" }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("tab", { name: "Add a song" })).toHaveAttribute("aria-selected", "true");
});
