import { expect, test, type Page } from "@playwright/test";
import { CODE, mockSession, PHONE, session, setSingerName } from "./session";

/** Holds the session state request until the returned function is called. */
async function holdSessionState(page: Page) {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/api/sessions/${CODE}`, async (route) => {
    if (route.request().method() === "GET") await held;
    return route.fallback();
  });
  return release;
}

const splash = (page: Page) => page.getByRole("status").filter({ hasText: "Setting the stage" });

test("the main screen shows the animated YouOke splash until the session arrives", async ({ page }) => {
  await mockSession(page, session({ isHost: true, current: null, queue: [] }));
  const release = await holdSessionState(page);
  await page.goto(`/s/${CODE}`);

  await expect(splash(page)).toBeVisible();
  await expect(splash(page).getByRole("img", { name: "YouOke" })).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

  release();
  await expect(page.getByRole("heading", { name: "Scan. Pick. Sing." })).toBeVisible();
  await expect(splash(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use(PHONE);

  test("a guest sees the splash while the room and the session load", async ({ page }) => {
    await mockSession(page, session());
    await setSingerName(page, "Leo");
    const release = await holdSessionState(page);
    await page.goto(`/join/${CODE}`);

    await expect(splash(page)).toBeVisible();
    release();
    await expect(page.getByRole("button", { name: /Queue · 3/ })).toBeVisible();
    await expect(splash(page)).toHaveCount(0);
  });
});

test("with less motion asked for, the splash logo holds still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockSession(page, session({ isHost: true, current: null, queue: [] }));
  await holdSessionState(page);
  await page.goto(`/s/${CODE}`);

  await expect(splash(page)).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
