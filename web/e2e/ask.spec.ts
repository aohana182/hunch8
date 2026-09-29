import { test, expect, type Page } from "@playwright/test";
import { deferred, mockProxy } from "./mockProxy.ts";

// The ball's accessible name is the one assertion that survives the switch
// from the placeholder button to the real canvas ball: the strings come
// straight from BallComposable.kt's contentDescription.
const ball = (page: Page) => page.getByRole("button", { name: /ball|responding|limit|won't answer/i });
const question = (page: Page) => page.getByRole("textbox", { name: "Ask a question and provide some context" });

async function ask(page: Page, text = "Should I take an umbrella? It's pouring.") {
  await question(page).fill(text);
  await ball(page).click();
}

// The ball bobs forever, so Playwright never sees it "stable" and won't click
// it. With reduced motion the bob and shake stop (a real feature, see the spec);
// the last test below covers tapping the ball while it moves.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(ball(page)).toHaveAccessibleName("Magic ball. Tap to ask.");
});

test("a 200 shows the phrase the proxy picked", async ({ page }) => {
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Most likely", confidence: 0.9, cost: 0 } }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("The ball says: Most likely");
  expect(proxy.questions).toEqual([{ question: "Should I take an umbrella? It's pouring.", background: "" }]);
});

test("a 429 shows the daily limit state", async ({ page }) => {
  await mockProxy(page, () => ({ status: 429, body: { error: "daily limit reached" } }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("Daily limit reached, come back tomorrow");
});

test("a 422 shows the refusal", async ({ page }) => {
  await mockProxy(page, () => ({ status: 422, body: { error: "blocked" } }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("Hunch8 won't answer that");
});

test("a 5xx shows that the app isn't responding", async ({ page }) => {
  await mockProxy(page, () => ({ status: 502, body: { error: "Jev call failed" } }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("The app isn't responding");
});

test("a network failure shows that the app isn't responding, without crashing", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  await mockProxy(page, () => ({ abort: true }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("The app isn't responding");
  expect(errors).toEqual([]);
});

test("the ball thinks while waiting, and a double tap sends only one question", async ({ page }) => {
  const response = deferred<{ status: number; body: unknown }>();
  const proxy = await mockProxy(page, () => ({ hold: response.promise }));

  await question(page).fill("Should I go?");
  await ball(page).dblclick();
  await expect(ball(page)).toHaveAccessibleName("The ball is thinking");
  // force: the ball is aria-disabled while thinking, and Playwright would
  // otherwise wait for it to re-enable instead of tapping mid-flight.
  await ball(page).click({ force: true });

  response.resolve({ status: 200, body: { answer: "Yes", confidence: 0.9 } });
  await expect(ball(page)).toHaveAccessibleName("The ball says: Yes");
  expect(proxy.questions).toHaveLength(1);
});

test("tapping with a blank question does nothing", async ({ page }) => {
  const proxy = await mockProxy(page, () => ({ status: 200, body: { answer: "Yes" } }));
  await question(page).fill("   ");
  await ball(page).click();
  await expect(ball(page)).toHaveAccessibleName("Magic ball. Tap to ask.");
  expect(proxy.questions).toHaveLength(0);
});

test("asking again after an answer works", async ({ page }) => {
  const answers = ["Yes", "Very doubtful"];
  await mockProxy(page, () => ({ status: 200, body: { answer: answers.shift(), confidence: 0.9 } }));
  await ask(page);
  await expect(ball(page)).toHaveAccessibleName("The ball says: Yes");
  await ball(page).click();
  await expect(ball(page)).toHaveAccessibleName("The ball says: Very doubtful");
});

test.describe("with motion on", () => {
  test.use({ reducedMotion: "no-preference" });

  test("tapping the bobbing ball still asks and answers", async ({ page }) => {
    await mockProxy(page, () => ({ status: 200, body: { answer: "Signs point to yes", confidence: 0.9 } }));
    await question(page).fill("Should I go?");
    // force: skip Playwright's "stable" wait - a person taps a moving ball just fine.
    await ball(page).click({ force: true });
    await expect(ball(page)).toHaveAccessibleName("The ball says: Signs point to yes");
  });
});
