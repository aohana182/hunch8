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

Hunch8 is an Android app built on [Jev](https://openrouter.ai/docs/guides/community/jev), TypeSafe's decision model on OpenRouter. Jev doesn't write text like a chatbot: it rates how strongly the answer to your question is *yes* and returns a number. Hunch8 turns that number into the matching 8-ball phrase.

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
    B -->|one request, two questions| C[OpenRouter Decisions API]
    C --> D[Jev]
    D -->|score 0-4 + moderation flag| B
    B -->|one of 20 phrases| A
```

1. You type one question with any context and tap the ball.
2. The app sends the text to a small proxy on Cloudflare Workers. The OpenRouter API key lives only there, never in the app.
3. The proxy asks Jev two things in one call: a **score** (0 = definitely no, 4 = definitely yes) and a **moderation check** (is this hateful?).
4. Flagged → the app shows a red ✕. Otherwise the score picks a band of phrases, one is chosen at random, and confidence below 0.6 always falls back to a non-committal phrase.
5. Each IP address gets 50 questions a day.

Real request/response traces, including the failures, are in [evals/traces.md](evals/traces.md).

---

## Quick start

You need your own OpenRouter API key and a Cloudflare account. The app in this repo points at the author's proxy, so to run your own copy you deploy the proxy first and then point the app at it.

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

Set `PROXY_URL` in `android/app/src/main/java/com/hunch8/app/network/ProxyClient.kt` to your Worker's URL, then:

```sh
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 17+ and the Android SDK (compileSdk 35, minSdk 26).

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | `proxy/.dev.vars` locally, `wrangler secret put` in production | OpenRouter key used to call Jev. Never goes in the app. |

The rate-limit store is a Workers KV namespace bound as `RATE_LIMIT_KV` in `proxy/wrangler.toml`.

---

## Tech stack

- **Kotlin + Jetpack Compose** — the Android app, including the fake-3D ball drawn on a Canvas
- **OkHttp** — the app's single HTTPS call to the proxy
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

---

## Status

Working debug build, tested on an emulator and a real phone. Not on the Play Store. Open work (release signing, app icon, Play Integrity, input length cap, crash reporting) is tracked in [tasks/todo.md](tasks/todo.md). Design decisions are in [PRD.md](PRD.md).

---

## Privacy

The app has no accounts, analytics, ads or tracking. The only thing that leaves your phone is the question you tap to ask. Full details in [PRIVACY.md](PRIVACY.md).

## Disclaimer

Entertainment only, provided as-is, with no warranty and no liability. Not affiliated with Mattel, TypeSafe or OpenRouter. Full text in [DISCLAIMER.md](DISCLAIMER.md).

---

## Contributing

```sh
git clone https://github.com/aohana182/hunch8
cd hunch8/proxy
npm install
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, commit format and PR process.

---

## License

MIT — see [LICENSE](LICENSE).
