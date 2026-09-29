import { test, expect, type Page } from "@playwright/test";
import { mockProxy } from "./mockProxy.ts";

// Screenshots of every ball state for side-by-side review against
// assets/screenshot-*.png. They're attached to the Playwright report (the CI
// artifact), not compared pixel-for-pixel: fonts differ per OS, so a human
// judges the match, as the spec says.
test.use({ reducedMotion: "reduce" }); // no bob, so every capture is framed the same

const ball = (page: Page) => page.getByRole("button", { name: /ball|responding|limit|won't answer/i });

async function capture(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
  // The ball alone, at device resolution, for close comparison with the Android crop.
  await test.info().attach(`${name}-ball`, {
    body: await page.locator(".ball-box").screenshot(),
    contentType: "image/png",
  });
}

async function askAndSettle(page: Page, status: number, body: unknown, expectedName: string) {
  await mockProxy(page, () => ({ status, body }));
  await page.getByRole("textbox").fill("Should I stay home or go to the concert? I have a fever of 39.");
  await ball(page).click();
  await expect(ball(page)).toHaveAccessibleName(expectedName);
  await page.waitForTimeout(2500); // flip (750 ms) + the reveal spring settling (~1.5 s)
}

test("idle", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);
  await capture(page, "idle");
});

test("answered", async ({ page }) => {
  await page.goto("/");
  await askAndSettle(page, 200, { answer: "You may rely on it", confidence: 0.9 }, "The ball says: You may rely on it");
  await capture(page, "answered");
});

test("error", async ({ page }) => {
  await page.goto("/");
  await askAndSettle(page, 502, { error: "Jev call failed" }, "The app isn't responding");
  await capture(page, "error");
});

test("rate limited", async ({ page }) => {
  await page.goto("/");
  await askAndSettle(page, 429, { error: "daily limit reached" }, "Daily limit reached, come back tomorrow");
  await capture(page, "rate-limited");
});

test("blocked", async ({ page }) => {
  await page.goto("/");
  await askAndSettle(page, 422, { error: "blocked" }, "Hunch8 won't answer that");
  await capture(page, "blocked");
});
