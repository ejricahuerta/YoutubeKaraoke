import { expect, test } from "@playwright/test";
import { CODE, mockSession, PHONE, session } from "./session";

test("the start page links to the terms, the privacy policy and the cookie policy", async ({ page }) => {
  for (const [link, heading] of [
    ["Terms", "Terms of Use"],
    ["Privacy", "Privacy Policy"],
    ["Cookies", "Cookie Policy"],
  ]) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("starting a session says it accepts the terms", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("By starting a session you agree to the Terms of Use")).toBeVisible();
});

test("the privacy policy says the app collects IP addresses and device information", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "What we collect" })).toBeVisible();
  await expect(page.getByText(/IP address/).first()).toBeVisible();
  await expect(page.getByText(/user agent/i).first()).toBeVisible();
});

test("the cookie policy lists the guest and host cookies and how long they last", async ({ page }) => {
  await page.goto("/cookies");
  const table = page.getByRole("table", { name: "Cookies and storage YouOke sets" });
  await expect(table.getByRole("row", { name: /^kg .*1 year/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /^kh_<CODE> .*30 days/ })).toBeVisible();
});

test("the policies say the main screen uses YouTube's privacy-enhanced mode, which still sets cookies once a song plays", async ({ page }) => {
  for (const path of ["/cookies", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByText(/privacy-enhanced mode \(youtube-nocookie\.com\)/).first(), path).toBeVisible();
    await expect(page.getByText(/no cookies on the main screen until a video plays/).first(), path).toBeVisible();
    await expect(page.getByText(/once the first song plays/).first(), path).toBeVisible();
  }
});

test("each legal page links to the other two and back to the start page", async ({ page }) => {
  await page.goto("/terms");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL("/privacy");
  await page.getByRole("link", { name: "Cookies", exact: true }).click();
  await expect(page).toHaveURL("/cookies");
  await page.getByRole("link", { name: "YouOke home" }).click();
  await expect(page).toHaveURL("/");
});

test.describe("on a phone", () => {
  test.use({ ...PHONE });

  test("a new guest is told joining accepts the terms, and can read them without losing the party", async ({ page }) => {
    await mockSession(page, session());
    await page.goto(`/join/${CODE}`);
    await expect(page.getByText("By joining you agree to the Terms of Use")).toBeVisible();
    const terms = page.getByRole("link", { name: "Terms of Use" });
    await expect(terms).toHaveAttribute("href", "/terms");
    await expect(terms).toHaveAttribute("target", "_blank");
  });

  test("the legal pages fit a phone screen", async ({ page }) => {
    await page.goto("/privacy");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("every legal page gives an email address to contact", async ({ page }) => {
  for (const path of ["/terms", "/privacy", "/cookies"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "me@edmel.dev" }).first()).toHaveAttribute("href", "mailto:me@edmel.dev");
  }
});

test("the terms say Ontario law applies, and the privacy policy covers Canadian privacy law", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/laws of the Province of Ontario and the federal laws of Canada/)).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByText(/PIPEDA/).first()).toBeVisible();
});

test("the terms cap liability at fifty Canadian dollars", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/limited to CAD 50 \(fifty Canadian dollars\)/)).toBeVisible();
});

test("the terms say YouTube playback is not guaranteed", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/We do not guarantee that the YouTube player will work/)).toBeVisible();
});

test("the policies say when a session closes on its own", async ({ page }) => {
  for (const path of ["/terms", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByText(/an hour after it started/).first(), path).toBeVisible();
    if (path === "/terms") await expect(page.getByText(/the browser that\s+started it can start a new one 15 minutes later/)).toBeVisible();
    await expect(page.getByText(/15 minutes after the main screen was last\s+open, or after 30 minutes with nothing playing/).first(), path).toBeVisible();
  }
});
