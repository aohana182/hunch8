# Hunch8 v0 — Task List

See `plan.md` for the full plan, architecture decisions, risks, and phase checkpoints.

## Task 1: Scaffold the Android app shell

**Description:** Create a new Kotlin + Jetpack Compose Android project (min SDK 26) named Hunch8, with an empty single-screen Compose UI that just displays the app name. No networking, no sensors, no real UI yet — this only proves the project builds and runs on the emulator.

**Acceptance criteria:**
- [x] App builds via Gradle with no errors
- [x] App installs and launches on the emulator, showing a blank screen with "Hunch8" text

**Verification:**
- [x] Build succeeds: `./gradlew assembleDebug`
- [x] Manual check: install on the existing emulator AVD and confirm it launches without crashing

**Dependencies:** None

**Files likely touched:**
- `android/app/build.gradle.kts`
- `android/app/src/main/java/.../MainActivity.kt`
- `android/settings.gradle.kts`

**Estimated scope:** S

---

## Task 2: Scaffold the Cloudflare Worker proxy shell

**Description:** Initialize a Cloudflare Worker project (TypeScript, via `wrangler`) with a single stub endpoint that accepts a POST with `{question, background}` and returns a hardcoded fake answer JSON. No real Jev call yet — this proves the deployment pipeline works before adding real logic.

**Acceptance criteria:**
- [x] Worker deploys successfully to Cloudflare
- [x] `POST <worker-url>` with a JSON body returns a hardcoded stub JSON response

**Verification:**
- [x] Build/deploy succeeds: `wrangler deploy` — live at https://hunch8-proxy.hunch8.workers.dev
- [x] Manual check: `POST` with a real body returns the stub response; missing `question` correctly returns a 400

**Dependencies:** None

**Files likely touched:**
- `proxy/wrangler.toml`
- `proxy/src/index.ts`

**Estimated scope:** S

---

## Task 3: Implement the real Jev call in the proxy

**Description:** Replace the stub with the real integration: the Worker takes `{question, background}`, builds a Decisions API `choice` request over the 20 canonical answers (per PRD Section 6's request shape), calls `POST https://openrouter.ai/api/alpha/decisions` with the OpenRouter API key held as a Worker secret, and returns `{answer: <phrase>, confidence: <number>}` to the caller (mapping the returned key back to the display phrase server-side, so the client never needs the key↔phrase table). Also confirm real per-token pricing on the live model page now that an API key is in hand (PRD flagged this as unverified).

**Acceptance criteria:**
- [ ] A real question + background produces a real Jev-selected answer (one of the exact 20 phrases), not a stub
- [ ] Response includes `usage.cost` from the underlying Jev response so real cost-per-call is observable
- [ ] API key is stored via `wrangler secret`, not committed to any file in the repo

**Verification:**
- [ ] Manual check: `curl` the deployed Worker with several different question/background pairs and confirm varied, plausible answers come back (not always the same one)
- [ ] Manual check: confirm the API key does not appear in `git diff` / any committed file
- [ ] Confirm real Jev input-token price from `https://openrouter.ai/typesafe/jev-1.13` (or the OpenRouter dashboard) and note it in `PRD.md` Section 6, replacing the "not independently confirmed" flag

**Dependencies:** Task 2

**Files likely touched:**
- `proxy/src/index.ts`
- `proxy/src/jev.ts` (new — request building, 20-answer criteria map)
- `proxy/wrangler.toml` (secret binding)

**Estimated scope:** M

---

## CHECKPOINT: Foundation (after Tasks 1–3)
- [ ] Proxy deployed and returns a real Jev-backed answer via `curl`
- [ ] Android app builds and runs an empty shell on the emulator
- [ ] Review with Avi before proceeding

---

## Task 4: Wire the app to the proxy with placeholder UI

**Description:** Add a plain Compose UI with two text fields (question, background) and a plain "Ask" button (temporary stand-in for the ball — replaced visually in Task 6). Wire an OkHttp/Retrofit client that POSTs to the deployed proxy URL and displays the raw returned answer text below the button. This is the ugly-but-working version of the full pipeline.

**Acceptance criteria:**
- [ ] Typing a question and background, then tapping "Ask," sends a real request to the deployed proxy
- [ ] The returned answer phrase renders as plain text on screen
- [ ] A loading indicator shows while the request is in flight

**Verification:**
- [ ] Build succeeds: `./gradlew assembleDebug`
- [ ] Manual check: on the emulator, run through the flow with 3+ different questions and confirm real (varied) answers appear

**Dependencies:** Task 1, Task 3

**Files likely touched:**
- `android/app/src/main/java/.../MainScreen.kt`
- `android/app/src/main/java/.../network/ProxyClient.kt`
- `android/app/build.gradle.kts` (OkHttp/Retrofit dependency)

**Estimated scope:** M

---

## Task 5: Confirm the 20-answer contract end-to-end

**Description:** Deliberately test edge cases of the question/background → answer mapping to confirm the full contract holds: empty background, very short question, contradictory background, very long background near the token limit. Fix any mismatches between the proxy's key↔phrase mapping and what the client expects to display.

**Acceptance criteria:**
- [ ] All 20 canonical phrases are reachable in principle (spot-check a handful actually appear across varied inputs; not required to force all 20 in one test pass)
- [ ] No malformed/unmapped answer ever reaches the UI (a proxy error or unrecognized key shows the error state from Task 8, not garbage text)

**Verification:**
- [ ] Manual check: run the 4 edge-case inputs above through the emulator and confirm sane behavior each time

**Dependencies:** Task 4

**Files likely touched:**
- `proxy/src/jev.ts`
- `android/app/src/main/java/.../network/ProxyClient.kt`

**Estimated scope:** S

---

## CHECKPOINT: Core flow proven (after Tasks 4–5)
- [ ] Typing a question, tapping the stand-in "Ask" button, and seeing one of the exact 20 canonical phrases render works on the emulator, backed by a real Jev call
- [ ] This is the point where the hardest technical risk is retired — review with Avi before investing in visual polish

---

## Task 6: Ball visual + tap gesture + reveal animation

**Description:** Replace the placeholder "Ask" button with a tappable ball composable. Add a brief "shaking/thinking" animation while the request is in flight, and an answer-reveal animation (text appears in a windowed area on the ball, echoing the classic 8-ball reveal) once the response arrives.

**Acceptance criteria:**
- [ ] Tapping the ball (not a separate button) triggers the same flow built in Task 4
- [ ] A visible animation plays during the network call, distinct from the idle state
- [ ] The answer appears via a reveal animation, not an instant text swap

**Verification:**
- [ ] Manual check: full flow on the emulator looks and feels intentional, not placeholder

**Dependencies:** Task 4

**Files likely touched:**
- `android/app/src/main/java/.../ui/BallComposable.kt` (new)
- `android/app/src/main/java/.../MainScreen.kt`

**Estimated scope:** M

---

## Task 7: Basic 3D rendering spike for the ball

**Description:** Per PRD Section 10, try rendering the ball with a lightweight 3D approach (Filament/SceneView) first, timeboxed. If it's too heavy to get looking good within the timebox, fall back to a well-shaded pseudo-3D illustration (gradients/specular highlights on a Canvas-drawn sphere). Whichever approach ships, the result must diverge from Mattel's specific trade dress (PRD Section 7): no "Magic 8 Ball" wordmark, no exact blue-liquid-triangle-window replica.

**Acceptance criteria:**
- [ ] The ball reads as "3D-ish" and good-looking, not flat/placeholder
- [ ] Visual design does not reproduce Mattel's specific color scheme/window shape/wordmark
- [ ] Approach taken (real 3D vs. shaded 2D) is noted in `PRD.md` Section 10, replacing the "worth revisiting" note

**Verification:**
- [ ] Manual visual check on the emulator
- [ ] Quick side-by-side comparison against a real Magic 8-Ball image to confirm the design has diverged enough (own judgment call, flag to Avi if unsure)

**Dependencies:** Task 6

**Files likely touched:**
- `android/app/src/main/java/.../ui/BallComposable.kt`
- `android/app/src/main/res/...` (3D model asset or drawable resources)

**Estimated scope:** M (spike — timebox before starting; fall back rather than let this run long)

---

## Task 8: Network-failure handling ("needs internet")

**Description:** Handle the case where the proxy call fails (no network, timeout, proxy error, rate-limit rejection). Show an explicit "needs internet"-style message per PRD Section 8. Must not crash and must not substitute a fake local answer.

**Acceptance criteria:**
- [ ] Airplane mode → tap ball → clear error message shown, no crash
- [ ] Proxy returning an HTTP error (e.g. simulated 500) is handled the same way, not treated as a valid answer

**Verification:**
- [ ] Manual check: toggle airplane mode on the emulator and confirm the error path
- [ ] Manual check: temporarily point the client at an invalid URL to simulate a proxy error and confirm graceful handling

**Dependencies:** Task 6

**Files likely touched:**
- `android/app/src/main/java/.../network/ProxyClient.kt`
- `android/app/src/main/java/.../MainScreen.kt`

**Estimated scope:** S

---

## CHECKPOINT: v0 UX complete (after Tasks 6–8)
- [ ] Full user-facing flow (question → background → tap ball → thinking animation → answer reveal) feels right on the emulator
- [ ] Airplane-mode test shows the error message without crashing
- [ ] Review with Avi before proceeding to release-readiness tasks

---

## Task 9: Rate limiting / abuse prevention on the proxy

**Description:** Add a per-IP (or per-device, if a lightweight device identifier is easy to add) daily request cap to the Worker, using Cloudflare KV or a Durable Object as the counter store. This is a hard requirement for a public app fronting a shared paid key (PRD Section 8), not optional polish.

**Acceptance criteria:**
- [ ] Requests past the configured daily cap are rejected with a clear error, not silently dropped or passed through
- [ ] Cap is configurable (a constant or env var), not hardcoded in multiple places

**Verification:**
- [ ] Manual check: script a burst of requests past the cap and confirm the later ones are throttled

**Dependencies:** Task 3

**Files likely touched:**
- `proxy/src/index.ts`
- `proxy/src/rateLimit.ts` (new)
- `proxy/wrangler.toml` (KV/Durable Object binding)

**Estimated scope:** M

---

## Task 10: Attribution screen ("powered by Jev")

**Description:** Add a simple settings/about screen showing "powered by Jev (TypeSafe, via OpenRouter)" attribution, per PRD Section 8. No API key entry UI needed (PRD Section 10 — no user-facing key entry in the shared-key model).

**Acceptance criteria:**
- [ ] An about/settings screen is reachable from the main screen and shows the attribution text

**Verification:**
- [ ] Manual check: navigate to the screen on the emulator and confirm the text is present and correct

**Dependencies:** Task 1

**Files likely touched:**
- `android/app/src/main/java/.../ui/AboutScreen.kt` (new)
- `android/app/src/main/java/.../MainScreen.kt` (navigation entry point)

**Estimated scope:** S

---

## Task 11: Privacy policy screen + link

**Description:** Add a privacy policy screen/link, disclosing that question/background text is sent to a third-party API (OpenRouter → TypeSafe) and is not stored server-side beyond the single request (PRD Section 7/9). Required by Play Store before any public release.

**Acceptance criteria:**
- [ ] Privacy policy text is present in-app and reachable from the about/settings screen
- [ ] Policy text accurately describes what's sent (question + background text) and to whom (OpenRouter/TypeSafe), and that it isn't logged/persisted server-side

**Verification:**
- [ ] Manual check: read the policy text against the actual data flow implemented in Tasks 3–4 and confirm it's accurate, not aspirational

**Dependencies:** Task 10

**Files likely touched:**
- `android/app/src/main/java/.../ui/PrivacyPolicyScreen.kt` (new)

**Estimated scope:** S

---

## CHECKPOINT: Release-ready (after Tasks 9–11)
- [ ] Burst of requests past the proxy's cap gets throttled (manually verified)
- [ ] No API key anywhere in the built APK (spot-checked via `apktool` or similar)
- [ ] Privacy policy present and linked
- [ ] All PRD Section 12 (v0) acceptance criteria met
- [ ] Final review with Avi before this is considered v0-done
