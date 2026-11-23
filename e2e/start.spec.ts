import { expect, test } from "@playwright/test";
import { OCCASION_EVERY_MS, OPENER_EVERY_MS } from "@/lib/domain/start-page";
import { PHONE } from "./session";

/** The headline as screen readers get it, however its first words are rolling. */
const HEADLINE = "Not okay? Hit start. Kara-OK.";
const GOOD_FOR = "Great for birthdays, game night, the office party, family get-togethers and roommates on a Friday.";

test("a big screen can start a session or join one by code", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(HEADLINE);
  await expect(page.getByRole("button", { name: "Start a session" })).toBeVisible();
  // No small print under the button or in the join card: the heading and intro say it all.
  await expect(page.getByText(/Closes itself/)).toHaveCount(0);
  await expect(page.getByText("Scan the QR code on the karaoke screen, or type its code.")).toHaveCount(0);

  await page.getByLabel("Session code").fill("abc234");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL("/join/ABC234");
});

test("the headline's question and the occasion beside the button roll over, while screen readers get steady words", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading.getByText("Not okay?").last()).toBeVisible();
  await expect(page.getByText("birthdays", { exact: true })).toBeVisible();
  await expect(page.getByText(GOOD_FOR)).toBeAttached();

  await page.clock.runFor(OPENER_EVERY_MS);
  await expect(heading.getByText("Bad day?")).toBeVisible();
  await expect(heading).toHaveAccessibleName(HEADLINE);

  await page.clock.runFor(OCCASION_EVERY_MS * 2 - OPENER_EVERY_MS);
  await expect(page.getByText("the office party", { exact: true })).toBeVisible();
});

test("with less motion asked for, the start page's words hold still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  await page.clock.runFor(OPENER_EVERY_MS * 3);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading.getByText("Not okay?").last()).toBeVisible();
  await expect(heading.getByText("Bad day?")).toHaveCount(0);
  await expect(page.getByText("birthdays", { exact: true })).toBeVisible();
  await expect(page.getByText("game night", { exact: true })).toHaveCount(0);
});

test("songs sung lately in any session rise behind the cards, without getting in the way", async ({ page }) => {
  await page.route(/ytimg\.com/, (route) => route.abort());
  await page.route("**/api/recent-songs", (route) =>
    route.fulfill({ json: { songs: [{ videoId: "video000001", title: "Valerie (Karaoke Version)" }, { videoId: "video000002", title: "Dancing Queen | Lyrics" }] } }),
  );
  await page.goto("/");
  const sungLately = page.getByRole("list", { name: "Sung lately" });
  await expect(sungLately.getByRole("listitem")).toHaveText(["Valerie", "Dancing Queen"]);

  // They pass behind the join card, so typing a code and joining still work.
  await page.getByLabel("Session code").fill("abc234");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL("/join/ABC234");
});

test("with nothing sung lately, or no answer, the start page shows no such list", async ({ page }) => {
  await page.route("**/api/recent-songs", (route) => route.fulfill({ json: { songs: [] } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start a session" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Sung lately" })).toHaveCount(0);

  await page.route("**/api/recent-songs", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("button", { name: "Start a session" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Sung lately" })).toHaveCount(0);
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

test("every response carries the security headers", async ({ page, request }) => {
  const responses = [await page.goto("/"), await page.goto("/join/ABC234"), await request.get("/api/search?q=")];
  for (const response of responses) {
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'"); // no other site may frame the app
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    // YouTube's player refuses to play without a referrer, so the origin must still be sent.
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("microphone=(self)"); // for singing on the main screen
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("pages carry the full policy as report-only, and reports are accepted", async ({ page, request }) => {
  const response = await page.goto("/");
  const policy = response!.headers()["content-security-policy-report-only"];
  expect(policy).toContain("frame-src https://www.youtube-nocookie.com;");
  expect(policy).toContain("report-uri /api/csp-report");

  const report = await request.post("/api/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: { "csp-report": { "document-uri": "http://localhost/", "violated-directive": "img-src", "blocked-uri": "https://example.com/x.png" } },
  });
  expect(report.status()).toBe(204);
});

test("the start page breaks none of its own policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  await page.goto("/");
  await page.getByLabel("Session code").fill("abc234");
  expect(violations).toEqual([]);
});
