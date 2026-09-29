import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ serviceWorkers: "allow", reducedMotion: "reduce" });

test("after one visit the app opens offline, and asking says the app isn't responding", async ({
  page,
  context,
  browserName,
}) => {
  // Playwright's WebKit fails page.reload() under setOffline with a generic
  // "internal error" (CI, 2026-09-30), so this can't tell us anything about
  // Safari there. Offline on iPhone is checked on a real device instead
  // (tasks/todo-web.md, Checkpoint C); Chromium covers the worker logic.
  test.skip(browserName === "webkit", "offline reload unsupported in Playwright WebKit - verify on a real iPhone");
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

test("a new worker waits instead of taking over, and applies only when told to", async ({ request }) => {
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain(`"SKIP_WAITING"`);
  // skipWaiting may only be reached from the message handler, never at install.
  expect(sw.match(/skipWaiting\(\)/g)).toHaveLength(1);
  expect(sw).toMatch(/message[\s\S]*SKIP_WAITING[\s\S]*skipWaiting\(\)/);
});

test("the files that pick the version are never cached; hashed assets are cached for good", async () => {
  // Cloudflare's _headers: an unindented path line, then indented "Name: value" lines.
  const rules = new Map<string, string>();
  let path = "";
  const file = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  for (const line of file.split(/\r?\n/)) {
    if (line.startsWith("#") || line.trim() === "") continue;
    if (!line.startsWith(" ")) path = line.trim();
    else rules.set(path, line.trim());
  }
  for (const p of ["/", "/index.html", "/sw.js", "/manifest.webmanifest"]) {
    expect(rules.get(p), p).toBe("Cache-Control: no-cache");
  }
  expect(rules.get("/assets/*")).toBe("Cache-Control: public, max-age=31536000, immutable");
});
