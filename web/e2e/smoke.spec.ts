import { test, expect } from "@playwright/test";

test("the app loads on the Hunch8 background", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Hunch8");
  await expect(page.getByRole("heading", { name: "Hunch8" })).toBeVisible();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(11, 24, 38)");
});
