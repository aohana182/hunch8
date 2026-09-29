# Spec: Hunch8 Web (PWA)

## Objective

A web version of Hunch8 that is a **faithful copy of the Android app**, installable as a PWA on Android Chrome, iPhone Safari and desktop browsers, with no Play Store needed.

It calls the **same Cloudflare Worker proxy** as the Android app. The proxy owns everything about Jev: the prompt, score bands, the 20 phrases, moderation and the rate limit. The web app knows nothing about Jev. Like `ProxyClient.kt`, it sends the question and displays what comes back.

**User flow (identical to Android):**

1. Type a yes/no question plus any context into the text field.
2. Tap the ball. Nothing happens if the field is blank or a request is already in flight.
3. The ball shakes while thinking, rolls from its "8" face to the window, and the answer floats up on a triangle.
4. The outcome is one of these states:

| Proxy response | Ball state | What the user sees |
|---|---|---|
| 200 with `answer` | `ANSWERED` | Answer on the blue triangle |
| 429 | `RATE_LIMITED` | "Daily limit\nreached" on the amber triangle |
| 422 | `BLOCKED` | No roll. Red ✕ over the "8" face |
| Any other status, bad JSON, network failure, timeout | `ERROR` | "App not\nresponding" on the red-brown triangle |

**The source of truth for looks and motion is the Android code, not this document:**

- `android/.../ui/BallComposable.kt`: geometry, colors, gradients, timings, springs, and the ball's accessibility descriptions
- `android/.../ui/Theme.kt`: palette
- `android/.../MainScreen.kt`: layout, input field, help dialog text
- `assets/screenshot-idle.png` and `assets/screenshot-answer.png`: visual reference

If this spec and the Kotlin code disagree, the Kotlin code wins.

**Port rules:**

- 1 dp = 1 CSS px and 1 sp = 1 CSS px.
- Compose `FastOutSlowInEasing` = `cubic-bezier(0.4, 0, 0.2, 1)`.
- `spring(dampingRatio = 0.45, stiffness = StiffnessVeryLow = 50)` is ported as a real damped-spring simulation, not a CSS approximation, because the overshoot wobble is the effect.

## Tech Stack

- **TypeScript 5**, strict, ESM, **no UI framework**. It's one screen with one canvas, so a framework would be most of the bundle.
- **Vite** for dev server and build.
- **Canvas 2D** for the ball, as a direct port of the Compose `DrawScope` code (radial and linear gradients, transforms, `cos()` foreshortening).
- **Hand-written** `manifest.webmanifest` and service worker, with no PWA plugin.
- **Node's built-in test runner** (`node --test`) for unit tests, the same as `proxy/`.
- **Playwright** for end-to-end tests against a mocked proxy.
- Runtime dependencies: none. Dev dependencies: `vite`, `typescript`, `@playwright/test`.

## Commands

All commands run from `web/`:

```sh
npm install
npm run dev          # vite dev server, http://localhost:5173
npm test             # node --test src/**/*.test.ts  (unit)
npm run typecheck    # tsc --noEmit
npm run e2e          # playwright test  (mocked proxy, no network)
                     # if Playwright's browsers can't be downloaded locally:
                     #   PW_CHROMIUM_CHANNEL=msedge npm run e2e -- --project=pixel-7 --project=desktop-chrome
npm run build        # vite build → web/dist
npm run preview      # serve web/dist locally (service worker active)
npm run icons        # regenerate PWA icons by cropping the ball out of assets/screenshot-idle.png
```

Deploys don't run from anyone's machine. They happen only through GitHub Actions (see **CI/CD**).

## CI/CD

One workflow, `.github/workflows/web.yml`. It runs only when `web/**` or the workflow file itself changes.

| Trigger | Jobs | Deploys? |
|---|---|---|
| `pull_request` → `main` | `test`: `npm ci`, unit tests, typecheck, build, and Playwright E2E on mocks (Chromium, plus WebKit for iPhone). The Playwright HTML report, with screenshots of each ball state, is uploaded as a workflow artifact so reviewers can see the UI without running anything. | **No.** PRs never touch Cloudflare or the real Worker. |
| `push` → `main` (a merged PR) | `test` (same as above), then `deploy`, which needs `test` to pass: build with `VITE_PROXY_URL` set from the repo variable `VITEURL`, then `wrangler pages deploy dist --project-name hunch8 --branch main` via `cloudflare/wrangler-action`. | **Yes**, to production `https://hunch8.pages.dev`. |

One-time setup:
- **Cloudflare Pages project:** created once with `wrangler pages project create hunch8 --production-branch main`, by any member of the account.
- **Cloudflare API token:** scoped to *Account → Cloudflare Pages → Edit* on the Android author's account.
- **GitHub repo settings** (only the repo owner can add these on a personal-account repo):
  - Secret `CLOUDFLARE_API_TOKEN`
  - Secret `CLOUDFLARE_ACCOUNT_ID`
  - Variable `VITEURL` (the Worker URL; the deploy job passes it to the build as `VITE_PROXY_URL`), so it stays out of tracked files like `local.properties` does
- **Production environment:** the `deploy` job runs in a GitHub `production` environment, so deploy history is visible and can be gated later.

## Configuration

| Variable | Where | Description |
|---|---|---|
| `VITE_PROXY_URL` | `web/.env.local` (gitignored by the root `.env*` rule) | The Worker URL, baked in at build time. In CI it comes from the repo variable `VITEURL`. A bare host (no `https://`) gets `https://` added. This mirrors `hunch8.proxyUrl` in `android/local.properties`. If it's missing, the build falls back to the same placeholder `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev`, and every ask shows "App not responding". |

The Worker must list the web app's origin in `ALLOWED_ORIGINS`. That's the CORS change, delivered separately.

## Project Structure

```
web/
  SPEC.md                 → this file
  README.md               → setup, config, deploy
  index.html              → single page: header, textarea, ball, help <dialog>
  public/
    manifest.webmanifest
    sw.js                 → app-shell cache; never touches proxy requests
    icons/                → generated by `npm run icons` (committed)
  src/
    main.ts               → wires DOM, state, proxy client
    proxyClient.ts        → ask(question) → Hunch8Result (port of ProxyClient.kt)
    state.ts              → BallState + transitions (port of MainScreen.kt logic)
    ball/
      draw.ts             → sphere, "8" decal, window, shading, gloss, triangle
      animation.ts        → easing, tween, damped spring
      ball.ts             → render loop driving flip / reveal / bob / shake / blocked ✕
    help.ts               → help dialog (text verbatim from HelpDialog in MainScreen.kt,
                            plus a "Privacy · Disclaimer" line linking to PRIVACY.md / DISCLAIMER.md on GitHub)
    styles.css            → palette tokens from Theme.kt
    *.test.ts             → unit tests next to the code they test
  e2e/
    ask.spec.ts           → one test per outcome row in the table above
  scripts/
    make-icons.ts         → crops the ball from assets/screenshot-idle.png onto the
                            #0B1826 background via Playwright's canvas; writes 192, 512,
                            maskable 512 (ball inside the 80% safe zone), 180 apple-touch, favicon
.github/workflows/
  web.yml                 → PR: test on mocks. main: test + deploy.
```

## Code Style

This follows the proxy: small modules, named exports, explicit `.ts` import extensions (required by `node --test`), and comments that say *why*, not what.

```ts
// Mirrors ProxyClient.kt: the status code is the whole contract. 429 and 422
// are distinct states the ball renders differently; anything else - including
// a 200 without an "answer" - is the same "App not responding" as no network.
export type Hunch8Result =
  | { kind: "success"; answer: string; confidence: number }
  | { kind: "rateLimited" }
  | { kind: "blocked" }
  | { kind: "networkError" };

export function resultFromResponse(status: number, body: unknown): Hunch8Result {
  if (status === 429) return { kind: "rateLimited" };
  if (status === 422) return { kind: "blocked" };
  if (status < 200 || status >= 300) return { kind: "networkError" };
  if (typeof body !== "object" || body === null || typeof (body as { answer?: unknown }).answer !== "string") {
    return { kind: "networkError" };
  }
  const { answer, confidence } = body as { answer: string; confidence?: unknown };
  return { kind: "success", answer, confidence: typeof confidence === "number" ? confidence : 0 };
}
```

Naming: `camelCase` functions and values, `PascalCase` types, `SCREAMING_SNAKE` constants. Constant names match their Kotlin names where one exists (`WINDOW_RADIUS`, `EIGHT_RADIUS`, `LIGHT_POSITION`), so a reviewer can put the two files side by side.

## Testing Strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | `node --test` | `resultFromResponse` for every status/body shape. State transitions: blank question ignored, tap during `THINKING` ignored, restored `THINKING` resets to `IDLE`. Easing curve endpoints, and that the spring settles and overshoots with the Kotlin parameters. |
| E2E | Playwright, proxy mocked with `page.route` | One test per outcome row. Each checks the ball's accessible name, which uses the exact strings from `BallComposable.kt`, e.g. `"The ball says: Most likely"`. Double-tap sends exactly one request. The help dialog opens and closes. Mobile (Pixel 7, iPhone 14) and desktop viewports. |
| Visual | Manual, side by side | Idle and answered screenshots next to `assets/screenshot-*.png`, reviewed by the Android author. |
| Live smoke | Manual | One real question against the deployed Worker after CORS is live. |

E2E never calls the real Worker, so it uses no quota and costs no money.

## Boundaries

- **Always:**
  - Run `npm test`, `npm run typecheck` and `npm run e2e` before each commit.
  - Use Conventional Commits and PRs to `main` (per `CONTRIBUTING.md`).
  - Port constants from the Kotlin code, not from screenshots.
  - Treat user text as text, never as HTML.
  - Honor `prefers-reduced-motion` by turning off the idle bob and the thinking shake. The flip and reveal still run, because they carry the answer.
- **Ask first:**
  - Any dependency beyond `vite`, `typescript` and `@playwright/test`.
  - Any change under `android/`, and any `proxy/` change other than the agreed CORS change.
  - Any workflow beyond `web.yml`, or any change to when it deploys.
  - Pages project settings or a custom domain.
  - Any visual or copy change that deviates from the Android app.
- **Never:**
  - Put an API key or any secret in `web/`.
  - Commit `.env.local` or a real Worker URL to tracked files.
  - Call OpenRouter directly from the browser.
  - Add analytics, tracking or persistent storage of questions. At most, `sessionStorage` for the draft question, mirroring `rememberSaveable`.
  - Push to `main` directly.
  - Deploy from a PR, or point PR tests at the real Worker.
  - Use the "Magic 8 Ball" wordmark or Mattel trade dress (PRD §7).

## Success Criteria

1. `npm test`, `npm run typecheck`, `npm run e2e` and `npm run build` all pass.
2. E2E proves all four outcome rows and the no-double-fire rule, at mobile and desktop sizes.
3. The Android author, viewing idle and answered screenshots side by side, agrees that the web version matches.
4. After one visit, the app opens with no network. Asking then shows "App not responding" without crashing (the airplane-mode test from PRD §12).
5. Chrome DevTools reports the app as installable (manifest, service worker, 192 and 512 icons, plus a maskable one). It installs to the home screen on a real Android phone and a real iPhone, and launches full-screen.
6. `web/dist` contains no `sk-or-` string and no OpenRouter hostname.
7. The layout works at 360 px wide with no horizontal scroll. On desktop, the column is centered at phone width.
8. Deployed on Cloudflare Pages in the Android author's account, a real question returns one of the 20 phrases through the Worker.
9. A PR that touches `web/` runs the `test` job and uploads the Playwright report, and nothing is deployed. Merging it to `main` deploys to `https://hunch8.pages.dev` with no manual step.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Pages project | `hunch8` → `https://hunch8.pages.dev`. Falls back to `hunch8-web` if the name is taken, and the Worker's `ALLOWED_ORIGINS` follows whichever is used. |
| 2 | Deploy | GitHub Actions. PRs only test on mocks, and a merge to `main` deploys to production. There are no preview deploys, so no preview URLs need CORS. |
| 3 | Privacy and Disclaimer | Added as a small line in the help dialog. This is the one intentional deviation from the Android app, which doesn't have it yet (its Task 11). |
| 4 | App icon | The ball cropped from `assets/screenshot-idle.png`, the same image the README shows. |
| 5 | Fonts | `Roboto, system-ui, sans-serif` with no web-font download. |
| 6 | CORS | We apply `docs/proxy-cors-for-web.md` ourselves, in a **separate PR merged and deployed first** (`feat/proxy-cors`), because the web app is useless until the Worker allows its origin. The Worker is deployed the way it is today (`npm run deploy` in `proxy/`), since automating that is out of scope. |
