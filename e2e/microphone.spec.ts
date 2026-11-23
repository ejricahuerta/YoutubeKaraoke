import { expect, test, type Page } from "@playwright/test";
import { CODE, mockSession, session, song } from "./session";

// Chromium's own fake microphone (a steady beep), allowed without asking, so the real audio graph runs.
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const hosting = () => session({ isHost: true, queue: [song(2, "Leo", "Song B")] });

async function openMicrophone(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: /^Microphone/ }).click();
  await expect(page.getByRole("dialog", { name: "Microphone" })).toBeVisible();
}

/**
 * Waits for the level meter to move. The fake mic beeps briefly once a second, so this looks
 * on every frame: polling once a second could keep landing in the silence between beeps.
 */
const meterPicksUpSound = (page: Page) =>
  page.waitForFunction(
    () => Number(document.querySelector('[role="meter"][aria-label="Microphone level"]')?.getAttribute("aria-valuenow")) > 0,
    undefined,
    { polling: "raf", timeout: 10_000 },
  );

test("the host turns the microphone on, sees it pick up sound, and it stays on after a reload", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);

  const toggle = page.getByRole("switch", { name: /Use the microphone/ });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("Live. Sing or speak to see the level.")).toBeVisible();
  await meterPicksUpSound(page);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Mic on")).toBeVisible();

  await page.reload();
  // The browser may keep a page's sound off until the first press.
  await page.mouse.click(5, 5);
  await expect(page.getByText("Mic on")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: /^Microphone/ })).toContainText("On");
});

test("Test mic makes the mic live for a while without turning it on, and closing the panel ends it", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);

  const testButton = page.getByRole("button", { name: "Test mic" });
  await testButton.click();
  await expect(page.getByRole("button", { name: "Stop test" })).toHaveAttribute("aria-pressed", "true");
  await meterPicksUpSound(page);
  await expect(page.getByRole("switch", { name: /Use the microphone/ })).not.toBeChecked();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Mic on")).toHaveCount(0);
  await openMicrophone(page);
  await expect(page.getByRole("button", { name: "Test mic" })).toHaveAttribute("aria-pressed", "false");
});

test("the sound settings and clean-up switches are kept on this screen, and Reset sound puts them back", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);

  await page.getByRole("slider", { name: "Echo", exact: true }).fill("70");
  await page.getByRole("slider", { name: "Echo delay" }).fill("400");
  await page.getByRole("slider", { name: "Room size" }).fill("90");
  await page.getByRole("switch", { name: /Auto volume/ }).click();

  await page.reload();
  await openMicrophone(page);
  await expect(page.getByRole("slider", { name: "Echo", exact: true })).toHaveValue("70");
  await expect(page.getByRole("slider", { name: "Echo delay" })).toHaveValue("400");
  await expect(page.getByText("400 ms")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Room size" })).toHaveValue("90");
  await expect(page.getByRole("switch", { name: /Auto volume/ })).toBeChecked();

  await page.getByRole("button", { name: "Reset sound" }).click();
  await expect(page.getByRole("slider", { name: "Echo", exact: true })).toHaveValue("30");
  await expect(page.getByRole("switch", { name: /Auto volume/ })).not.toBeChecked();
});

test("the host can pick which microphone to use", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);
  await page.getByRole("switch", { name: /Use the microphone/ }).click();
  await expect(page.getByText("Live. Sing or speak to see the level.")).toBeVisible();

  const input = page.getByRole("combobox", { name: /^Input/ });
  await expect.poll(() => input.locator("option").count()).toBeGreaterThan(1);
  const chosen = await input.locator("option").nth(1).getAttribute("value");
  await input.selectOption(chosen!);
  await expect(page.getByText("Live. Sing or speak to see the level.")).toBeVisible();
  await expect(input).toHaveValue(chosen!);
});

test("a blocked microphone says how to allow it", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);
  await page.getByRole("switch", { name: /Use the microphone/ }).click();

  const dialog = page.getByRole("dialog", { name: "Microphone" });
  await expect(dialog.getByText(/The browser blocked the microphone/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  // Still on, so the main screen keeps saying why there is no sound.
  await expect(page.getByText(/The browser blocked the microphone/)).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: /^Microphone/ })).toContainText("Blocked");
});

test("up and down move between the panel's controls, as on a TV remote", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);

  await expect(page.getByRole("switch", { name: /Use the microphone/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("combobox", { name: /^Input/ })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "Done" })).toBeFocused();
});

test("the panel shows how late the voice comes out", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);
  await page.getByRole("switch", { name: /Use the microphone/ }).click();

  await expect(page.getByText(/^Delay at least \d+ ms$/)).toBeVisible();
});

test("a Bluetooth mic gets a warning that it lags, and what to use instead", async ({ page }) => {
  // The fake mic, named the way Windows names a Bluetooth headset.
  await page.addInitScript(() => {
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await open(constraints);
      for (const track of stream.getAudioTracks()) Object.defineProperty(track, "label", { value: "Headset (WH-1000XM4 Hands-Free AG Audio)" });
      return stream;
    };
  });
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);
  await page.getByRole("switch", { name: /Use the microphone/ }).click();

  await expect(page.getByText(/^Delay at least \d+ ms, plus Bluetooth$/)).toBeVisible();
  await expect(page.getByText(/This is a Bluetooth mic/)).toBeVisible();
});

test("Low latency turns the clean-up off, and is kept on this screen", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);

  const echoCancellation = page.getByRole("switch", { name: /Echo cancellation/ });
  await expect(echoCancellation).toBeChecked();
  await page.getByRole("switch", { name: /Low latency/ }).click();
  await expect(echoCancellation).not.toBeChecked();
  await expect(echoCancellation).toBeDisabled();
  await expect(page.getByRole("switch", { name: /Noise suppression/ })).toBeDisabled();

  await page.reload();
  await openMicrophone(page);
  await expect(page.getByRole("switch", { name: /Low latency/ })).toBeChecked();
  await page.getByRole("switch", { name: /Low latency/ }).click();
  // The host's own choices come back.
  await expect(echoCancellation).toBeChecked();
  await expect(echoCancellation).toBeEnabled();
});

test("Measure delay beeps through the speakers and says how late the mic heard them", async ({ page }) => {
  await mockSession(page, hosting());
  await page.goto(`/s/${CODE}`);
  await openMicrophone(page);
  await page.getByRole("switch", { name: /Use the microphone/ }).click();

  await page.getByRole("button", { name: "Measure delay" }).click();
  await expect(page.getByRole("button", { name: "Measuring…" })).toBeDisabled();
  // Chromium's fake mic cannot hear the speakers, so either answer is right here; on a real
  // device it is the delay.
  await expect(page.getByText(/^\d+ ms \(\d+–\d+ ms, \d+ beeps?\)\.|didn’t hear the beeps/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Measure delay" })).toBeEnabled();
});
