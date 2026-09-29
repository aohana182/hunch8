import { defineConfig, devices } from "@playwright/test";
import { MOCK_PROXY_URL } from "./e2e/mockProxy.ts";

// E2E runs against a production build whose proxy URL is a fake host that
// every test intercepts with page.route - the real Worker is never called,
// so tests cost no quota and no money. The build goes to dist-e2e so it can
// never be mistaken for a deployable dist/.
const PORT = 4173;

// Optional: run the Chromium projects on an installed browser channel (e.g.
// "msedge") when Playwright's own Chromium can't be downloaded. CI leaves it unset.
const chromiumChannel = process.env.PW_CHROMIUM_CHANNEL ? { channel: process.env.PW_CHROMIUM_CHANNEL } : {};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "on",
    // page.route can't see requests that pass through a service worker, so
    // the proxy mocks need it off; offline.spec.ts turns it back on.
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "pixel-7", use: { ...devices["Pixel 7"], ...chromiumChannel } },
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], ...chromiumChannel } },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_PROXY_URL: MOCK_PROXY_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
