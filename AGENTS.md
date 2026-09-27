# Hunch8 — Agent Context

## What this is
An Android magic 8-ball app. The user types one yes/no question with any context and taps the ball. A Cloudflare Worker proxy sends the text to TypeSafe's Jev decision model via OpenRouter's Decisions API, gets back a 0–4 score plus a moderation flag, and returns one of the 20 classic 8-ball phrases. Hobby project, entertainment only, debug build, not on the Play Store.

## Stack
- Android: Kotlin, Jetpack Compose (Material 3), OkHttp, coroutines; compileSdk 35, minSdk 26, AGP 8.5.2, Kotlin 2.0.20
- Proxy: TypeScript Cloudflare Worker, Workers KV (rate limiting), Wrangler 4
- Model: `typesafe/jev-1.13` through `POST https://openrouter.ai/api/alpha/decisions`
- Tests: Node's built-in test runner (`node --test`), no test framework dependency

## Structure
- `android/app/src/main/java/com/hunch8/app/` — `MainScreen.kt` (input, help dialog, state), `ui/BallComposable.kt` (ball rendering and animations), `ui/Theme.kt` (palette), `network/ProxyClient.kt` (HTTP + result mapping)
- `proxy/src/` — `index.ts` (routing, status codes), `jev.ts` (Jev request, score→phrase bands, moderation), `rateLimit.ts` (50/IP/day via KV), `*.test.ts`
- `evals/traces.md` — real request/response traces against the live proxy
- `PRD.md` — requirements and design decisions; `tasks/` — plan and task log

## How to run
```sh
cd proxy && npm install && npm test && npm run dev
cd android && ./gradlew assembleDebug
```

## Key decisions
- The API key lives only in the proxy (the app is meant for public release, so a key in the APK would be extractable).
- Jev's **Score** primitive, not Choice: Choice over 20 labels gave worse answers and identical phrasing on repeats. Score bands + a random pick within the band work better.
- Confidence below 0.6 forces the non-committal band, so a coin-flip result never reads as "Without a doubt".
- For "X or Y?" questions, yes means the first option X (stated in the Jev instructions).
- Moderation is a second `noul` question in the same Jev request (no extra call); flagged → HTTP 422 → red ✕ on the ball.
- The ball is fake 3D: a fixed circle with decals moving across it with cos() foreshortening. Do not tilt the whole disc with `rotationX/Y`; that turns a sphere into an ellipse.
- No anti-prompt-injection code: tested three injection attempts and all failed, because users only control `state`, never `instructions`/`criteria`, and the output is a number.

## Out of scope
Voice input, shake-to-ask (planned for v0.1), answer history, accounts, monetization, answers outside the 20 classic phrases.

## Gotchas
- `PROXY_URL` is hardcoded in `ProxyClient.kt` and points at the author's Worker.
- `wrangler.toml` contains the author's KV namespace id; replace it with your own (`npx wrangler kv namespace create RATE_LIMIT_KV`).
- Test files import with an explicit `.ts` extension (required by Node's native TS stripping) and are excluded from `tsc --noEmit`.
- On Windows, `curl` to Cloudflare can fail TLS revocation checks; use `--ssl-no-revoke`, or `node --use-system-ca` for fetch.
- The Android 12+ splash screen shows a default icon for a few seconds on cold start; screenshots taken too early show that, not a crash.
