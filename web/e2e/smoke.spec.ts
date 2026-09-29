import { test, expect } from "@playwright/test";

test("the app loads on the Hunch8 surface color", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Hunch8");
  await expect(page.getByRole("heading", { name: "Hunch8" })).toBeVisible();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Hunch8Surface (#122333): MainActivity wraps the screen in a Material Surface.
  expect(background).toBe("rgb(18, 35, 51)");
});
