# Hunch8 Web

The web version of Hunch8: an installable PWA that is a faithful copy of the Android app. It calls **the same Cloudflare Worker** (`../proxy`), so the Jev prompt, the 20 phrases, moderation and the 50-per-IP daily limit are shared. The web app never sees the OpenRouter key.

Live at **https://hunch8.pages.dev**. Spec: [`SPEC.md`](SPEC.md). Plan: [`../tasks/plan-web.md`](../tasks/plan-web.md).

## Run it

Needs Node 24+ (the unit tests run `.ts` files natively).

```sh
cd web
npm install
npx playwright install chromium webkit   # once, for the E2E tests
npm run dev                               # http://localhost:5173
```

To ask real questions locally, point it at a Worker. `localhost:5173` is in the Worker's `ALLOWED_ORIGINS`.

```sh
# web/.env.local (gitignored)
VITE_PROXY_URL=https://your-worker.your-subdomain.workers.dev
```

Without it, every ask shows "App not responding", the same as an Android build without `hunch8.proxyUrl`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server. No service worker. |
| `npm test` | Unit tests (`node --test`): proxy client, state, animation maths, drawing helpers, saved session |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e` | Playwright on Pixel 7, iPhone 14 (WebKit) and desktop Chrome, against a production build with a **fake Worker**, so it never uses quota. The report (`playwright-report/`) has a screenshot of every ball state. |
| `npm run build` | Production build to `dist/`, with the service worker stamped with a version and a precache list |
| `npm run preview` | Serve `dist/` (service worker active) |
| `npm run icons` | Regenerate `public/icons/` from the ball in `../assets/screenshot-idle.png` |

If Playwright's browsers can't be downloaded, run the Chromium projects on an installed browser: `PW_CHROMIUM_CHANNEL=msedge npm run e2e -- --project=pixel-7 --project=desktop-chrome`.

## How it's built

- **No UI framework.** It's one screen and one canvas, and the JS is about 12 kB.
- **`src/ball/`** ports `BallComposable.kt`:
  - `draw.ts` is the `DrawScope` code on Canvas 2D, with the same constant names.
  - `animation.ts` is Compose's easing, spring and `Animatable`.
  - `ball.ts` holds the `LaunchedEffect`s, the bob and the shake.
- **`src/proxyClient.ts`** ports `ProxyClient.kt`: 429 means rate limited, 422 means blocked, and anything else is "App not responding".
- **`public/sw.js`** makes the app open offline after one visit. Asking still needs the network, and says so. It never touches the request to the Worker.

## PWA behavior

- **Updates:** a new service worker installs in the background and waits. `src/pwaUpdate.ts` swaps it in only when no request is in flight and the user isn't typing (or the app is in the background), then reloads; the question survives in `sessionStorage`. The app checks for a new `sw.js` whenever it returns to the foreground and hourly. `public/_headers` keeps `/`, `sw.js` and the manifest at `no-cache` and `/assets/*` immutable.
- **Phone motion (opt-in):** one switch in the help dialog (touch devices only) turns on the motion sensor for two things. `src/motionControl.ts` reads `devicemotion`, converts it to the screen's frame (the page can be held sideways) and hands the samples on.
  - **Shake to ask:** `src/shake.ts` is the pure detector (3 jolts of ≥14 m/s² change within 900 ms, 1.5 s cooldown). It runs the same action as tapping the ball. Android also vibrates briefly on an answer.
  - **Ball follows the phone:** `src/ball/inertia.ts` is a mass on springs that moves only the decals (the "8", the window, the floating answer) over the fixed sphere, so the disc never turns into an ellipse. Tilting rolls the face downhill relative to how the phone is usually held; a jump or shove makes it lag and overshoot; turning the phone counter-rotates it so the answer stays level. `prefers-reduced-motion` turns it off.
  - **Not verified on real phones:** iOS needs the permission prompt from a tap (it asks again on the first tap after a relaunch), and iOS may report the axes with the opposite sign — `INVERTED_AXES` in `motionControl.ts` is the switch if the ball moves the wrong way there. Landscape mapping is derived, not measured.

## Deploys

Deploys run only through GitHub Actions (`.github/workflows/web.yml`):

- **Pull request:** tests only. It never deploys and never calls the real Worker.
- **Merge to `main`:** tests, then `wrangler pages deploy` to the `hunch8` Pages project. The job creates the project on its first run.

It needs these repo settings:
- secrets `CLOUDFLARE_API_TOKEN` (Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`
- variable `VITEURL`, the Worker URL (a bare host is fine)

If the Pages URL ever changes, update `ALLOWED_ORIGINS` in `../proxy/wrangler.toml` and redeploy the Worker. Otherwise the browser blocks every answer.
