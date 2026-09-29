import { test, expect } from "@playwright/test";
import { mockProxy } from "./mockProxy.ts";

test.use({ reducedMotion: "reduce" });

const question = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Ask a question and provide some context" });

test("the help dialog opens from ?, shows the Android text and legal links, and closes back to ?", async ({ page }) => {
  await page.goto("/");
  const help = page.getByRole("button", { name: "How to use Hunch8" });
  await help.click();

  const dialog = page.getByRole("dialog", { name: "How to use Hunch8" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Trigger: tap the ball.");
  await expect(dialog).toContainText("Powered by Jev");
  await expect(dialog.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", /PRIVACY\.md$/);
  await expect(dialog.getByRole("link", { name: "Disclaimer" })).toHaveAttribute("href", /DISCLAIMER\.md$/);

  await dialog.getByRole("button", { name: "Got it" }).click();
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
});

test("Esc closes the help dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How to use Hunch8" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the ✕ clears the question and only shows when there is text", async ({ page }) => {
  await page.goto("/");
  const clear = page.getByRole("button", { name: "Clear question" });
  await expect(clear).toBeHidden();
  await question(page).fill("Should I go?");
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(question(page)).toHaveValue("");
  await expect(clear).toBeHidden();
});

test("a reload keeps the question and the answer, like rememberSaveable", async ({ page }) => {
  await mockProxy(page, () => ({ status: 200, body: { answer: "Outlook good", confidence: 0.9 } }));
  await page.goto("/");
  await question(page).fill("Should I go?");
  await page.getByRole("button", { name: /Magic ball/ }).click();
  await expect(page.getByRole("button", { name: "The ball says: Outlook good" })).toBeVisible();

  await page.reload();
  await expect(question(page)).toHaveValue("Should I go?");
  await expect(page.getByRole("button", { name: "The ball says: Outlook good" })).toBeVisible();
});

test("no horizontal scrolling on a 360 px wide phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await question(page).fill("A long question with plenty of context to wrap across several lines of the field");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
