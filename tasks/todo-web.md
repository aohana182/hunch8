# Hunch8 Web: Task List

Plan: [`plan-web.md`](plan-web.md). Spec: [`../web/SPEC.md`](../web/SPEC.md).

Definition of done for every task: its acceptance criteria are met, `npm test` and `npm run typecheck` are green for the package it touched, it's committed with a Conventional Commit message, and nothing secret is in the diff.

---

## PR 0: Worker CORS (`feat/proxy-cors`)

### Task 1: Apply the CORS change to `proxy/`

**Description:** Implement `docs/proxy-cors-for-web.md`. Add `cors.ts`, wrap `fetch` in `index.ts`, add the `[vars] ALLOWED_ORIGINS` line to `wrangler.toml`, add `cors.test.ts`, and note `ALLOWED_ORIGINS` in `.dev.vars.example` and the README's environment-variables table.

**Acceptance criteria:**
- [ ] `OPTIONS` returns 204 before the method check and the rate limiter, so it doesn't use up quota.
- [ ] Every response (200, 400, 405, 422, 429, 500, 502) carries the CORS headers for an allowed origin, and none for other origins.
- [ ] No behavior change for requests without an `Origin` header (Android).

**Verification:**
- [ ] `cd proxy && npm test && npx tsc --noEmit`
- [ ] `npm run dev`, then the three curl checks from the doc against `127.0.0.1:8787`

**Dependencies:** None
**Files:** `proxy/src/cors.ts`, `proxy/src/cors.test.ts`, `proxy/src/index.ts`, `proxy/wrangler.toml`, `proxy/.dev.vars.example`, `README.md`
**Scope:** M

### Task 2: Deploy the Worker and verify it in production

**Description:** After the PR is reviewed and merged, a member runs `npx wrangler login` (choosing the Android author's account), then `npm run deploy` in `proxy/`.

**Acceptance criteria:**
- [ ] The production preflight from `https://hunch8.pages.dev` returns `Access-Control-Allow-Origin`, and `https://evil.example` doesn't.
- [ ] The Android app still gets an answer.

**Verification:**
- [ ] curl checks against the production Worker URL (on Windows, add `--ssl-no-revoke`)
- [ ] One question in the Android app

**Dependencies:** Task 1
**Files:** none (deploy only)
**Scope:** XS

---

## PR 1: Walking skeleton (`feat/web-skeleton`)

### Task 3: Scaffold `web/`

**Description:** Create `package.json` with the scripts from the spec, plus `tsconfig.json` (strict, `allowImportingTsExtensions`, `noEmit`), `vite.config.ts`, a minimal `index.html`, `src/main.ts`, `src/styles.css` with the palette tokens from `Theme.kt`, and `playwright.config.ts` (Pixel 7, iPhone 14 on WebKit, and Desktop Chrome, served by `vite preview`). Add `web/node_modules`, `web/dist`, `web/test-results` and `web/playwright-report` to the root `.gitignore`.

**Acceptance criteria:**
- [ ] `npm run dev` serves a page with the dark `#0B1826` background.
- [ ] `npm test`, `npm run typecheck`, `npm run build` and `npm run e2e` all run. An empty or smoke-level suite passing is enough here.
- [ ] Dev dependencies are only `vite`, `typescript` and `@playwright/test`.

**Verification:**
- [ ] All four commands exit 0
- [ ] `git status` shows no build output tracked

**Dependencies:** None
**Files:** `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/playwright.config.ts`, `web/index.html`, `web/src/main.ts`, `web/src/styles.css`, `.gitignore`
**Scope:** M

### Task 4: Proxy client and state machine, test-first

**Description:** `proxyClient.ts` ports `ProxyClient.kt`: `resultFromResponse(status, body)` plus `ask(question)`, which POSTs `{question, background: ""}` to `VITE_PROXY_URL` (placeholder fallback) with a 15-second timeout. `state.ts` ports the `MainScreen.kt` logic: it ignores a blank question or a tap while `THINKING`, and maps each result to `ANSWERED`, `RATE_LIMITED`, `BLOCKED` or `ERROR`.

**Acceptance criteria:**
- [ ] Every row of the spec's outcome table is covered by a unit test, including 200 without `answer`, invalid JSON, a network throw and a timeout.
- [ ] Blank or whitespace-only questions and taps during `THINKING` produce no request.

**Verification:**
- [ ] `npm test`
- [ ] `npm run typecheck`

**Dependencies:** Task 3
**Files:** `web/src/proxyClient.ts`, `web/src/proxyClient.test.ts`, `web/src/state.ts`, `web/src/state.test.ts`
**Scope:** S

### Task 5: Placeholder UI wired end to end, plus E2E

**Description:** Temporary UI: a textarea plus a round `<button>` standing in for the ball, whose accessible name is the exact per-state description from `BallComposable.kt`. The answer shows as text. Playwright tests use `page.route` to fake the Worker.

**Acceptance criteria:**
- [ ] E2E covers 200, 429, 422, 500 and network abort, each asserting the button's accessible name, e.g. `"The ball says: Most likely"`.
- [ ] A fast double-click sends exactly one request.
- [ ] Tests pass on all three Playwright projects.

**Verification:**
- [ ] `npm run e2e`
- [ ] Manual: `npm run dev` with `web/.env.local` pointing at the real Worker, then ask one question (needs Task 2)

**Dependencies:** Task 4
**Files:** `web/index.html`, `web/src/main.ts`, `web/e2e/ask.spec.ts`, `web/e2e/mockProxy.ts`
**Scope:** M

### Task 6: CI workflow, test job

**Description:** `.github/workflows/web.yml` triggers on `pull_request` and `push` to `main`, filtered to `web/**` and the workflow file. Steps: Node LTS, `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, a step that fails if `web/dist` contains `sk-or-` or `openrouter.ai`, then `npx playwright install --with-deps chromium webkit` and `npm run e2e`. The Playwright report is uploaded as an artifact even when tests fail.

**Acceptance criteria:**
- [ ] The workflow runs on the PR and is green.
- [ ] The Playwright report artifact is downloadable and shows screenshots.
- [ ] No Cloudflare step and no secrets are used.

**Verification:**
- [ ] Workflow run page on the PR (`gh pr checks`)

**Dependencies:** Task 5
**Files:** `.github/workflows/web.yml`
**Scope:** S

### Checkpoint A
- [ ] Green locally and in CI
- [ ] A real phrase via `npm run dev` against the real Worker
- [ ] The Android author reviews, then merge. Also ask him now for the repo secrets needed by Task 13.

---

## PR 2: The ball (`feat/web-ball`)

### Task 7: Animation primitives, test-first

**Description:** `animation.ts` provides `fastOutSlowIn` (cubic-bezier 0.4, 0, 0.2, 1), a `tween(durationMs, easing)` and a damped-spring stepper using Compose's model (stiffness, damping ratio, visibility threshold 0.01).

**Acceptance criteria:**
- [ ] The easing hits 0 and 1 at its ends and is monotonic.
- [ ] `spring(0.45, 50)` from 0 to 1 overshoots above 1, then settles within the threshold.
- [ ] Steps are frame-rate independent: 30 fps and 120 fps end at the same value within tolerance.

**Verification:**
- [ ] `npm test`

**Dependencies:** Task 3
**Files:** `web/src/ball/animation.ts`, `web/src/ball/animation.test.ts`
**Scope:** S

### Task 8: Static ball drawing

**Description:** `draw.ts` ports `drawSphereBody`, `drawEightDecal`, `drawWindowDecal`, `drawSphereShading`, `drawGloss`, the triangle, and the floor shadow. It uses the same constants (`WINDOW_RADIUS`, `EIGHT_RADIUS`, `LIGHT_POSITION`, all colors) and the `onSurface` cos() foreshortening. The canvas is sized for `devicePixelRatio`.

**Acceptance criteria:**
- [ ] The idle ball at 300 px matches `assets/screenshot-idle.png` for position, lighting, "8" disc and gloss.
- [ ] `flip = 180` shows the window face, matching `screenshot-answer.png` minus the triangle.
- [ ] Crisp on a 3× display (no blur).

**Verification:**
- [ ] Playwright screenshot of idle and flipped, placed next to the reference screenshots and reviewed by eye
- [ ] `npm run typecheck`

**Dependencies:** Task 3
**Files:** `web/src/ball/draw.ts`, `web/e2e/ball-visual.spec.ts`
**Scope:** M

### Task 9: Ball states and motion

**Description:** `ball.ts` runs a `requestAnimationFrame` loop that ports the `LaunchedEffect`s:
- flip over 750 ms with the fast-out-slow-in curve
- reveal: 220 ms back to 0 while thinking, then the spring to 1 once the flip has finished
- idle bob of ±4 px over 2200 ms
- thinking shake: ±7 px sideways and ±4° over 70 ms
- the ✕ fading in over 200 ms and growing from 0.7× scale
- triangle colors and text sizes per `answerFontSize`

`BLOCKED` never flips. `prefers-reduced-motion` turns off the bob and the shake. This replaces the Task 5 placeholder while keeping the same accessible names.

**Acceptance criteria:**
- [ ] Each state looks like Android: answered is blue, error is red-brown, rate-limited is amber, and blocked shows the ✕ on the "8" face.
- [ ] The answer only rises after the flip completes, with the wobble.
- [ ] All Task 5 E2E tests pass unchanged, and the report has a screenshot of each state.

**Verification:**
- [ ] `npm run e2e`
- [ ] Manual: a side-by-side screen recording with the Android app for one ask

**Dependencies:** Tasks 5, 7, 8
**Files:** `web/src/ball/ball.ts`, `web/src/main.ts`, `web/e2e/ask.spec.ts`
**Scope:** M

### Checkpoint B
- [ ] The Android author confirms the side-by-side match (idle, answered, and the motion)
- [ ] CI green, then merge

---

## PR 3: Parity, PWA and deploy (`feat/web-pwa`)

### Task 10: Screen parity

**Description:**
- **Header:** "Hunch8" with an amber "?" button.
- **Text field:** an outlined field with the label "Ask a question and provide some context", 3–6 lines, an amber ✕ that clears it, and an amber border on focus.
- **Help dialog:** a native `<dialog>` with the text copied verbatim from `HelpDialog`, plus a "Privacy · Disclaimer" line linking to the GitHub files.
- **Draft:** the question is kept in `sessionStorage`, and a restored `THINKING` state resets to `IDLE`.
- **Layout:** a 24 px side gutter, the ball filling the remaining height, a centered phone-width column on desktop, and `dvh` units.

**Acceptance criteria:**
- [ ] E2E: the help dialog opens, closes with the button and with Esc, and focus returns to "?".
- [ ] No horizontal scroll at 360 px. The textarea's focus ring and label match the Android colors.
- [ ] Reloading keeps the typed question.

**Verification:**
- [ ] `npm run e2e`
- [ ] Manual: compare with `screenshot-idle.png` at 412 px wide

**Dependencies:** Task 9
**Files:** `web/index.html`, `web/src/help.ts`, `web/src/main.ts`, `web/src/styles.css`, `web/e2e/screen.spec.ts`
**Scope:** M

### Task 11: Icons and manifest

**Description:** `scripts/make-icons.ts` loads `assets/screenshot-idle.png` into a Playwright page's canvas. It crops the ball (about 790 px across, centered near 540,1452) onto `#0B1826`, then writes:
- `icon-192.png` and `icon-512.png`
- `icon-maskable-512.png`, with the ball inside the 80% safe zone
- `apple-touch-icon.png` at 180 px
- `favicon-32.png`

It also adds `manifest.webmanifest` (name and short_name "Hunch8", `display: standalone`, `background_color` and `theme_color` `#0B1826`, `start_url: "/"`) and the head tags in `index.html`, including the `apple-mobile-web-app-*` ones.

**Acceptance criteria:**
- [ ] Icons are committed, and the ball is centered and uncropped in each.
- [ ] Chrome DevTools → Application → Manifest shows no errors.

**Verification:**
- [ ] `npm run icons`, then look at each PNG
- [ ] DevTools manifest panel

**Dependencies:** Task 3
**Files:** `web/scripts/make-icons.ts`, `web/public/icons/*`, `web/public/manifest.webmanifest`, `web/index.html`, `web/package.json`
**Scope:** M

### Task 12: Service worker

**Description:** `public/sw.js` handles only same-origin `GET` requests. Page loads are network-first, falling back to the cached page. Assets are cache-first. The cache name carries a build id, and old caches are deleted on activate. It never intercepts the Worker request. It's registered from `main.ts` in production builds only.

**Acceptance criteria:**
- [ ] E2E against `vite preview`: load once, go offline, reload, and the app appears. Tapping with a question gives "The app isn't responding".
- [ ] After a rebuild with a new build id, the next online load serves the new version.
- [ ] Chrome reports the app as installable.

**Verification:**
- [ ] `npm run build && npm run e2e` (offline spec)
- [ ] DevTools → Application → Service Workers and the Install prompt

**Dependencies:** Tasks 10, 11
**Files:** `web/public/sw.js`, `web/src/main.ts`, `web/vite.config.ts`, `web/e2e/offline.spec.ts`
**Scope:** M

### Task 13: One-time deploy setup

**Description:**
- **Pages project:** a member runs `npx wrangler pages project create hunch8 --production-branch main`. If `hunch8` is taken, use `hunch8-web` and update `ALLOWED_ORIGINS` (PR 0 files) to match.
- **Repo settings:** the Android author (repo owner) adds secrets `CLOUDFLARE_API_TOKEN` (Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID` (**both done**), variable `VITEURL` (**done**, but its value needs `https://` or relies on the app adding it), and a `production` environment.

**Acceptance criteria:**
- [ ] `npx wrangler pages project list` shows the project.
- [ ] `gh secret list` and `gh variable list` show the names.

**Verification:** the listed commands
**Dependencies:** Task 2
**Files:** none
**Scope:** XS

### Task 14: Deploy job and docs

**Description:** Add a `deploy` job to `web.yml`: `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: test`, `environment: production`. It builds with `VITE_PROXY_URL: ${{ vars.VITEURL }}`, then runs `cloudflare/wrangler-action` with `pages deploy dist --project-name hunch8 --branch main`. Also write `web/README.md` (setup, config, how deploys work) and add short "Web" pointers to the root `README.md` and `AGENTS.md`.

**Acceptance criteria:**
- [ ] PR runs show the `deploy` job as skipped.
- [ ] The merge to `main` deploys, and the Pages dashboard shows a production deployment from the commit.
- [ ] The live site answers a real question, and installs on a real Android phone and a real iPhone.

**Verification:**
- [ ] Actions run log
- [ ] Open `https://hunch8.pages.dev` and ask one question
- [ ] Device installs

**Dependencies:** Tasks 6, 12, 13
**Files:** `.github/workflows/web.yml`, `web/README.md`, `README.md`, `AGENTS.md`
**Scope:** S

### Checkpoint C: Done
- [ ] Spec success criteria 1–9 are all checked
- [ ] The Android author signs off
