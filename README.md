<p align="center">
  <img src="assets/screenshot-idle.png" alt="Hunch8 idle" width="260">
  &nbsp;&nbsp;
  <img src="assets/screenshot-answer.png" alt="Hunch8 answering" width="260">
</p>

# Hunch8

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
  <a href="https://github.com/aohana182/hunch8/issues"><img src="https://img.shields.io/badge/Issues-welcome-yellow?style=for-the-badge" alt="Issues"></a>
</p>

**Ask a yes/no question, tap the ball, and get one of the 20 classic magic 8-ball answers — chosen by a real decision model reading your question, not by a coin flip.**

Hunch8 is an Android app and an installable web app built on [Jev](https://openrouter.ai/docs/guides/community/jev), TypeSafe's decision model on OpenRouter. Jev doesn't write text like a chatbot: it rates how strongly the answer to your question is *yes* and returns a number. Hunch8 turns that number into the matching 8-ball phrase.

**Try it in your browser: <https://hunch8.pages.dev>.** On a phone, add it to your home screen and it opens like an app.

<table>
<tr><td><b>Reads your context</b></td><td>"Should I stay home or go to the concert? I have a fever of 39." gets "You may rely on it" — stay home.</td></tr>
<tr><td><b>Honest when unsure</b></td><td>When Jev isn't confident, you get "Reply hazy, try again" instead of a fake "Without a doubt".</td></tr>
<tr><td><b>Never the same twice</b></td><td>Ask again and you get a different phrase with the same verdict, like shaking a real ball.</td></tr>
<tr><td><b>Refuses hateful questions</b></td><td>Racist or harassing questions get a red ✕ instead of an answer.</td></tr>
<tr><td><b>Feels like the toy</b></td><td>The ball rolls from its 8 to the window and the answer floats up on a triangle.</td></tr>
</table>

> **For entertainment only.** Hunch8 is a toy. Don't make real decisions with it. See [DISCLAIMER.md](DISCLAIMER.md).

---

## How it works

```mermaid
flowchart LR
    A[Android app] -->|question text| B[Cloudflare Worker proxy]
    W[Web app, hunch8.pages.dev] -->|question text| B
    B -->|one request, two questions| C[OpenRouter Decisions API]
    C --> D[Jev]
    D -->|score 0-4 + moderation flag| B
    B -->|one of 20 phrases| A
    B -->|one of 20 phrases| W
```

1. You type one question with any context and tap the ball.
2. The app, Android or web, sends the text to a small proxy on Cloudflare Workers. The OpenRouter API key lives only there, never in either app. Both apps share the proxy, so they give the same kind of answers under the same rules.
3. The proxy asks Jev two things in one call: a **score** (0 = definitely no, 4 = definitely yes) and a **moderation check** (is this hateful?).
4. Flagged → the app shows a red ✕. Otherwise the score picks a band of phrases, one is chosen at random, and confidence below 0.6 always falls back to a non-committal phrase.
5. Each IP address gets 50 questions a day.

Real request/response traces, including the failures, are in [evals/traces.md](evals/traces.md).

---

## Quick start

You need your own OpenRouter API key and a Cloudflare account. This repo ships with a placeholder proxy address, so you deploy your own proxy first and then point the app at it (see [Proxy address](#proxy-address)).

**1. Proxy (Cloudflare Worker)**

```sh
git clone https://github.com/aohana182/hunch8
cd hunch8/proxy
npm install
cp .dev.vars.example .dev.vars          # put your OpenRouter key in it
npx wrangler kv namespace create RATE_LIMIT_KV   # paste the returned id into wrangler.toml
npm test
npm run dev                             # local proxy on http://127.0.0.1:8787
```

To deploy:

```sh
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npm run deploy
```

**2. Android app**

```sh
cd android
cp local.properties.example local.properties   # set hunch8.proxyUrl to your Worker's URL
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 17+ and the Android SDK (compileSdk 35, minSdk 26).

**3. Web app**

```sh
cd web
npm install
echo "VITE_PROXY_URL=https://your-worker.your-subdomain.workers.dev" > .env.local
npm run dev                             # http://localhost:5173
```

Requires Node 24+. Browsers only accept the proxy's answers on origins listed in `ALLOWED_ORIGINS` in `proxy/wrangler.toml`. `http://localhost:5173` is already listed. If you host your own copy, add its address and redeploy the proxy. More in [web/README.md](web/README.md).

### Proxy address

The app sends every question to one address: your proxy. That address is **not** stored in the code. It lives in `android/local.properties`, which git ignores:

```properties
hunch8.proxyUrl=https://your-worker.your-subdomain.workers.dev
```

At build time, Gradle reads that line and bakes the address into the app as `BuildConfig.PROXY_URL`, which `ProxyClient.kt` uses. If the file or the line is missing, the build still succeeds but uses the placeholder `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev`, and every question shows "App not responding".

The address isn't a secret the way the API key is, because anyone holding a built APK can read it out of the app. Keeping it out of the repo just means the public code doesn't advertise a live endpoint. What actually protects the proxy is that the OpenRouter key never leaves Cloudflare, and the 50-questions-per-IP-per-day limit. If you run your own copy, also set a credit limit on your OpenRouter key to cap the worst case.

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | `proxy/.dev.vars` locally, `wrangler secret put` in production | OpenRouter key used to call Jev. Never goes in the app. |
| `ALLOWED_ORIGINS` | `[vars]` in `proxy/wrangler.toml` (override locally in `proxy/.dev.vars`) | Comma-separated web origins allowed to call the proxy from a browser (CORS), e.g. the web app's `https://hunch8.pages.dev`. Not needed for the Android app. |
| `hunch8.proxyUrl` | `android/local.properties` (gitignored) | Address of your deployed proxy, baked into the app at build time. See [Proxy address](#proxy-address). |
| `VITE_PROXY_URL` | `web/.env.local` (gitignored); in CI, the repo variable `VITEURL` | Address of your proxy for the web build. The web counterpart of `hunch8.proxyUrl`. A bare host without `https://` works too. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secrets | Let GitHub Actions deploy the web app to Cloudflare Pages. The token needs *Cloudflare Pages: Edit*. |

The rate-limit store is a Workers KV namespace bound as `RATE_LIMIT_KV` in `proxy/wrangler.toml`.

---

## Tech stack

- **Kotlin + Jetpack Compose** — the Android app, including the fake-3D ball drawn on a Canvas
- **OkHttp** — the app's single HTTPS call to the proxy
- **TypeScript + Vite** — the web app, with no UI framework. The ball is a Canvas 2D port of the Compose drawing code, and a service worker lets it open offline.
- **Cloudflare Pages + GitHub Actions** — hosting for the web app, deployed on every merge to `main`
- **Playwright** — web end-to-end tests on Pixel 7, iPhone and desktop sizes, against a fake proxy
- **Cloudflare Workers (TypeScript)** — the proxy that holds the API key and enforces the rate limit
- **Workers KV** — per-IP daily request counters
- **OpenRouter Decisions API + Jev** (`typesafe/jev-1.13`) — the decision model

---

## Scripts

| Command | Where | Description |
|---|---|---|
| `npm test` | `proxy/` | Unit tests for the score→phrase mapping and the rate limiter |
| `npx tsc --noEmit` | `proxy/` | Type-check the Worker |
| `npm run dev` | `proxy/` | Run the proxy locally |
| `npm run deploy` | `proxy/` | Deploy the proxy to Cloudflare |
| `./gradlew assembleDebug` | `android/` | Build the debug APK |
| `npm run dev` | `web/` | Run the web app locally |
| `npm test` | `web/` | Unit tests: proxy client, screen state, animation maths, ball drawing helpers |
| `npm run typecheck` | `web/` | Type-check the web app |
| `npm run e2e` | `web/` | Playwright end-to-end tests against a fake proxy (no quota used) |
| `npm run build` | `web/` | Production build to `web/dist` |

### Deploys

- **Web:** automatic. `.github/workflows/web.yml` runs the web tests on every pull request that touches `web/`, and never deploys from a PR. A merge to `main` runs the same tests, then deploys to Cloudflare Pages.
- **Proxy:** manual, with `npm run deploy` in `proxy/`.

---

## Status

**Web:** live at https://hunch8.pages.dev. It's an installable PWA copy of the Android app, in [`web/`](web/README.md), deployed automatically from `main`. It calls the same proxy, so answers, moderation and the daily limit are shared. Tested in Chromium and WebKit through Playwright, and end to end against the live proxy. Home-screen install on real Android phones and iPhones hasn't been checked yet.

**Android:** working debug build, tested on an emulator and a real phone. Not on the Play Store. Open work (release signing, app icon, Play Integrity, input length cap, crash reporting) is tracked in [tasks/todo.md](tasks/todo.md). Design decisions are in [PRD.md](PRD.md).

---

## Privacy

Neither app has accounts, analytics, ads or tracking. The only thing that leaves your device is the question you tap to ask. The web app keeps your draft question in the browser tab (`sessionStorage`) so it survives a reload. It's gone when you close the tab. Full details in [PRIVACY.md](PRIVACY.md).

## Disclaimer

Entertainment only, provided as-is, with no warranty and no liability. Not affiliated with Mattel, TypeSafe or OpenRouter. Full text in [DISCLAIMER.md](DISCLAIMER.md).

---

## Contributing

```sh
git clone https://github.com/aohana182/hunch8
cd hunch8/proxy && npm install && npm test
cd ../web && npm install && npm test && npm run e2e
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, commit format and PR process.

---

## License

MIT — see [LICENSE](LICENSE).
