/** Inviting a friend from the phone (#51): the share sheet, each app, copying, and the QR code. */
import { expect, test } from "@playwright/test";
import { CODE, mockSession, PHONE, session, setSingerName } from "./session";

test.use({ ...PHONE });

/** Makes the browser report a share sheet (or none), and records what was shared. */
async function fakeShareSheet(page: import("@playwright/test").Page, available: boolean) {
  await page.addInitScript((has) => {
    const shared: unknown[] = [];
    Object.defineProperty(window, "__shared", { value: shared });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: has ? async (data: unknown) => void shared.push(data) : undefined,
    });
  }, available);
}

async function openInvite(page: import("@playwright/test").Page) {
  await mockSession(page, session());
  await setSingerName(page, "Leo");
  await page.goto(`/join/${CODE}`);
  await page.getByRole("button", { name: "Invite a friend" }).click();
  return page.getByRole("dialog", { name: "Invite a friend" });
}

test("the invite offers the phone's share sheet, and sends the room's link through it", async ({ page }) => {
  await fakeShareSheet(page, true);
  const invite = await openInvite(page);
  const joinUrl = new URL(`/join/${CODE}`, page.url()).href;

  await invite.getByRole("button", { name: "Share…" }).click();
  expect(await page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared)).toEqual([
    { title: `Karaoke: room ${CODE}`, text: `Come sing karaoke with us! Room ${CODE}:`, url: joinUrl },
  ]);
});

test("without a share sheet, every app is still a tap away", async ({ page }) => {
  await fakeShareSheet(page, false);
  const invite = await openInvite(page);
  const joinUrl = encodeURIComponent(new URL(`/join/${CODE}`, page.url()).href);

  await expect(invite.getByRole("button", { name: "Share…" })).toHaveCount(0);
  for (const [name, start] of [
    ["WhatsApp", "https://wa.me/?text="],
    ["Messages", "sms:?&body="],
    ["Messenger", `fb-messenger://share/?link=${joinUrl}`],
    ["Telegram", `https://t.me/share/url?url=${joinUrl}`],
    ["Email", "mailto:?subject="],
  ]) {
    await expect(invite.getByRole("link", { name })).toHaveAttribute("href", new RegExp(`^${start.replace(/[?.*+^$()|[\]\\]/g, "\\$&")}`));
  }
});

test("the link can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const invite = await openInvite(page);
  await invite.getByRole("button", { name: "Copy link" }).click();
  await expect(invite.getByRole("status")).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(`/join/${CODE}`, page.url()).href);
});

test("the room's QR code is there for someone standing next to you", async ({ page }) => {
  const invite = await openInvite(page);
  await expect(invite.getByRole("img", { name: "QR code to join this karaoke session" })).toBeVisible();
  await expect(invite.getByText(new URL(`/join/${CODE}`, page.url()).href)).toBeVisible();
});

test("the invite closes with its button or Escape, back where it was", async ({ page }) => {
  const invite = await openInvite(page);
  await invite.getByRole("button", { name: "Close" }).click();
  await expect(invite).toBeHidden();
  await expect(page.getByRole("button", { name: "Invite a friend" })).toBeFocused();

  await page.getByRole("button", { name: "Invite a friend" }).click();
  await expect(invite).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(invite).toBeHidden();
});
