/** One browser, one room: every tab of a browser is in the same room under the same name. */
import { expect, test } from "@playwright/test";
import { CODE, mockOtherRoom, mockSession, PHONE, session, setRoom, setSingerName } from "./session";

test.use({ ...PHONE });

const OTHER = "XYZ789";

test("a new tab of the app goes back to the room this browser is in", async ({ page, context }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("button", { name: "Leo, change name" })).toBeVisible();

  const tab = await context.newPage();
  await mockSession(tab, session());
  await tab.goto("/");
  await expect(tab).toHaveURL(new RegExp(`/join/${CODE}$`));
  await expect(tab.getByRole("button", { name: "Leo, change name" })).toBeVisible();
});

test("a link to another room offers to go back or to switch rooms", async ({ page, context }) => {
  await mockSession(page, session());
  await mockOtherRoom(page, OTHER, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("button", { name: "Leo, change name" })).toBeVisible();

  const tab = await context.newPage();
  await mockSession(tab, session());
  await mockOtherRoom(tab, OTHER, session());
  const otherRoomCalls: string[] = [];
  tab.on("request", (request) => {
    if (request.url().includes(`/api/sessions/${OTHER}`)) otherRoomCalls.push(request.url());
  });
  await tab.goto(`/join/${OTHER}`);
  await expect(tab.getByRole("heading", { name: `You're in room ${CODE}` })).toBeVisible();
  // Loading a room counts as joining it (it can even make you its remote), so nothing is loaded yet.
  expect(otherRoomCalls).toEqual([]);
  await expect(tab.getByRole("link", { name: `Back to room ${CODE}` })).toHaveAttribute("href", `/join/${CODE}`);

  // Switching moves the whole browser: the first tab no longer shows the old room.
  await tab.getByRole("button", { name: `Switch to room ${OTHER}` }).click();
  await expect(tab.getByRole("button", { name: "Leo, change name" })).toBeVisible();
  await expect(page.getByRole("heading", { name: `You're in room ${OTHER}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `Back to room ${OTHER}` })).toBeVisible();
});

test("a room that has ended does not hold the browser", async ({ page }) => {
  await mockOtherRoom(page, OTHER, session({ archived: true, current: null, queue: [] }));
  await mockSession(page, session());
  await setRoom(page, OTHER);
  await setSingerName(page, "Leo");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Join" })).toBeVisible(); // stays on the start page
  await page.goto(`/join/${CODE}`);
  await expect(page.getByRole("button", { name: "Leo, change name" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("karaoke:room"))).toBe(CODE);
});

test("a guest can leave the room, and the app stops sending them back", async ({ page }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);

  await page.getByRole("button", { name: "Leo, change name" }).click();
  await page.getByRole("button", { name: `Leave room ${CODE}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
});

test("a new name shows in every tab", async ({ page, context }) => {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  const tab = await context.newPage();
  await mockSession(tab, session());
  await tab.goto(`/join/${CODE}`);
  await expect(tab.getByRole("button", { name: "Leo, change name" })).toBeVisible();

  await page.getByRole("button", { name: "Leo, change name" }).click();
  await page.getByLabel("Your name").fill("Leona");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(tab.getByRole("button", { name: "Leona, change name" })).toBeVisible();
});
