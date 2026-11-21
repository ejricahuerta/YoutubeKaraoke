import { expect, test } from "@playwright/test";
import { PHONE } from "./session";

test("a big screen can start a session or join one by code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start a session" })).toBeVisible();

  await page.getByLabel("Session code").fill("abc234");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL("/join/ABC234");
});

test("when a session cannot be started, the start page says so", async ({ page }) => {
  // The test server's database address is a placeholder, so starting a session really fails.
  await page.goto("/");
  await page.getByRole("button", { name: "Start a session" }).click();
  await expect(page).toHaveURL("/?error=unavailable");
  await expect(page.getByRole("alert").filter({ hasText: "couldn't start a session" })).toBeVisible();
});

test("an error code the page does not know shows nothing", async ({ page }) => {
  await page.goto("/?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.getByRole("button", { name: "Start a session" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ ...PHONE });

  test("the start page only offers joining", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Session code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start a session" })).toHaveCount(0);
  });
});
