import { test, expect, type Page } from "@playwright/test";
import { mockProxy } from "./mockProxy.ts";
import { answerMotionPermission } from "./motionPermission.ts";

test.use({ reducedMotion: "reduce" });

// Only phones expose the switch; desktop projects have no coarse pointer.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "shake is offered on touch devices - covered on the Pixel 7 profile");
  await answerMotionPermission(page, "granted");
});

const ball = (page: Page) => page.getByRole("button", { name: /ball|responding|limit|won't answer/i });

// Alternating hard jolts, 150 ms apart, like a real shake.
async function shakePhone(page: Page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      const x = i % 2 === 0 ? 12 : -12;
      window.dispatchEvent(new DeviceMotionEvent("devicemotion", { accelerationIncludingGravity: { x, y: 0, z: 9.8 } }));
      await new Promise((r) => setTimeout(r, 150));
    }
  });
}

async function enableShake(page: Page) {
  await page.getByRole("button", { name: "How to use Hunch8" }).click();
  await page.getByRole("checkbox", { name: "Use phone motion: shake to ask, ball follows your tilt" }).check();
  await page.getByRole("button", { name: "Got it" }).click();
}

test("with shake on, shaking the phone asks the question like tapping the ball", async ({ page }) => {
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Signs point to yes", confidence: 0.9, cost: 0 } }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Ask a question and provide some context" }).fill("Should I go?");
  await enableShake(page);

  await shakePhone(page);
  await expect(ball(page)).toHaveAccessibleName("The ball says: Signs point to yes");
  expect(proxy.questions).toHaveLength(1);
});

test("shake does nothing until the user turns it on", async ({ page }) => {
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Yes", confidence: 0.9, cost: 0 } }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Ask a question and provide some context" }).fill("Should I go?");
  await shakePhone(page);
  await expect(ball(page)).toHaveAccessibleName("Magic ball. Tap to ask.");
  expect(proxy.questions).toHaveLength(0);
});

test("the choice is remembered, and shaking with an empty question asks nothing", async ({ page }) => {
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Yes", confidence: 0.9, cost: 0 } }));
  await page.goto("/");
  await enableShake(page);
  await page.reload();
  await page.getByRole("button", { name: "How to use Hunch8" }).click();
  await expect(page.getByRole("checkbox", { name: "Use phone motion: shake to ask, ball follows your tilt" })).toBeChecked();
  await page.getByRole("button", { name: "Got it" }).click();

  await shakePhone(page);
  expect(proxy.questions).toHaveLength(0);
});

test("if the browser refuses the motion permission, the switch turns itself back off and shaking does nothing", async ({ page }) => {
  await answerMotionPermission(page, "denied"); // runs after the beforeEach's, so it wins
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Yes", confidence: 0.9, cost: 0 } }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Ask a question and provide some context" }).fill("Should I go?");
  await page.getByRole("button", { name: "How to use Hunch8" }).click();
  const toggle = page.getByRole("checkbox", { name: /Use phone motion/ });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.getByRole("button", { name: "Got it" }).click();

  await shakePhone(page);
  expect(proxy.questions).toHaveLength(0);
});
