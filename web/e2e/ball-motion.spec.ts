import { test, expect, type Page } from "@playwright/test";

// The ball's face follows the phone only on touch devices with motion switched on.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "motion is offered on touch devices - covered on the Pixel 7 profile");
});

const faceImage = (page: Page) => page.locator("#ball-canvas").evaluate((c) => (c as HTMLCanvasElement).toDataURL());

async function enableMotion(page: Page) {
  await page.getByRole("button", { name: "How to use Hunch8" }).click();
  await page.getByRole("checkbox", { name: /Use phone motion/ }).check();
  await page.getByRole("button", { name: "Got it" }).click();
}

// Holds the phone upright for half a second, then turns it 30° clockwise (right edge down)
// and keeps it there, sampling at 60 Hz like a real sensor. The sensor reads against gravity.
async function turnPhoneClockwise(page: Page) {
  await page.evaluate(async () => {
    const send = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      window.dispatchEvent(
        new DeviceMotionEvent("devicemotion", {
          accelerationIncludingGravity: { x: -9.8 * Math.sin(a), y: 9.8 * Math.cos(a), z: 0 },
        }),
      );
    };
    for (let i = 0; i < 30; i++) {
      send(0);
      await new Promise((r) => setTimeout(r, 16));
    }
    for (let i = 0; i < 90; i++) {
      send(30);
      await new Promise((r) => setTimeout(r, 16));
    }
  });
}

test.describe("with motion on", () => {
  test.use({ reducedMotion: "no-preference" });

  test("turning the phone moves the face of the ball; the ball itself stays round", async ({ page }) => {
    await page.goto("/");
    await enableMotion(page);
    const before = await faceImage(page);
    await turnPhoneClockwise(page);
    const after = await faceImage(page);
    expect(after).not.toBe(before);
    // The disc is never tilted or squashed: the canvas keeps its square, unrotated box.
    const box = await page.locator("#ball-canvas").boundingBox();
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
  });

  test("with motion off, the phone turning changes nothing", async ({ page }) => {
    await page.goto("/");
    const before = await faceImage(page);
    await turnPhoneClockwise(page);
    expect(await faceImage(page)).toBe(before);
  });
});

test("reduced motion keeps the face still even with motion on", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await enableMotion(page);
  const before = await faceImage(page);
  await turnPhoneClockwise(page);
  expect(await faceImage(page)).toBe(before);
});
