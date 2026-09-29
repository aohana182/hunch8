import type { Page } from "@playwright/test";

// Chromium and Safari both gate the motion sensor behind
// DeviceMotionEvent.requestPermission(), and what a headless browser answers
// differs by build. Tests pin the answer so they mean the same everywhere.
export async function answerMotionPermission(page: Page, answer: "granted" | "denied") {
  await page.addInitScript((value) => {
    Object.defineProperty(DeviceMotionEvent, "requestPermission", { value: async () => value, configurable: true });
  }, answer);
}
