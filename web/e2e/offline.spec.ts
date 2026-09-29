import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

test("after one visit the app opens offline, and asking says the app isn't responding", async ({ page, context }) => {
  await page.goto("/");
  // Wait until the worker has installed (precache done) and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hunch8" })).toBeVisible();

  await page.getByRole("textbox", { name: "Ask a question and provide some context" }).fill("Should I go?");
  await page.getByRole("button", { name: "Magic ball. Tap to ask." }).click();
  await expect(page.getByRole("button", { name: "The app isn't responding" })).toBeVisible();
});

test("the service worker is stamped with a build version and precaches this build's files", async ({ page, request }) => {
  await page.goto("/");
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toMatch(/const VERSION = "[0-9a-f]{12}";/);
  const script = await page.locator("script[type=module]").getAttribute("src");
  expect(sw).toContain(`"${script}"`);
  expect(sw).toContain(`"/icons/icon-512.png"`);
});

test("the manifest makes the app installable: name, standalone display, 192 and 512 icons, a maskable one", async ({
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Hunch8", short_name: "Hunch8", display: "standalone", start_url: "/" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
