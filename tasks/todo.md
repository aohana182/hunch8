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
- [x] A real question + background produces a real Jev-selected answer (one of the exact 20 phrases), not a stub
- [x] Response includes `cost` derived from the underlying Jev response's `usage.cost`, so real cost-per-call is observable
- [x] API key is stored via `wrangler secret put`, not committed to any file in the repo

**Verification:**
- [x] Manual check: tested 5 different question/background pairs against both local (`wrangler dev` + `.dev.vars`) and the live deployment — answers were varied and plausible (e.g. no-runway startup → "My sources say no"; empty background → "Reply hazy, try again"; strong positive weather background → "It is decidedly so")
- [x] Manual check: confirmed via `git diff --staged` scan that the key never appears in any committed file; `.dev.vars` is gitignored
- [x] Real pricing: `typesafe/jev-1.13` isn't in OpenRouter's public model catalog (only `typesafe/jev-router` is, with dynamic pricing), so there's no static rate to confirm. Used real measured `usage.cost` instead ($0.000015–$0.000034/call observed) and noted this in `PRD.md` Section 6, replacing the "not independently confirmed" flag. Also caught and fixed a real bug this way: the docs' example response shape was wrong (flat `answer` vs. actual nested `answers.answer`) — found by reading the live response directly instead of re-guessing after the first failure.

**Dependencies:** Task 2

**Files likely touched:**
- `proxy/src/index.ts`
- `proxy/src/jev.ts` (new — request building, 20-answer criteria map)
- `proxy/wrangler.toml` (secret binding)

**Estimated scope:** M

---

## CHECKPOINT: Foundation (after Tasks 1–3)
- [x] Proxy deployed and returns a real Jev-backed answer via `curl`/fetch (https://hunch8-proxy.hunch8.workers.dev)
- [x] Android app builds and runs an empty shell on the emulator
- [ ] Review with Avi before proceeding

---

## Task 4: Wire the app to the proxy with placeholder UI

**Description:** Add a plain Compose UI with two text fields (question, background) and a plain "Ask" button (temporary stand-in for the ball — replaced visually in Task 6). Wire an OkHttp/Retrofit client that POSTs to the deployed proxy URL and displays the raw returned answer text below the button. This is the ugly-but-working version of the full pipeline.

**Acceptance criteria:**
- [x] Typing a question and background, then tapping "Ask," sends a real request to the deployed proxy
- [x] The returned answer phrase renders as plain text on screen
- [x] A loading indicator shows while the request is in flight

**Verification:**
- [x] Build succeeds: `./gradlew assembleDebug`
- [x] Manual check: ran 3 different questions through the actual app UI on the emulator — "Will it rain tomorrow?" (storm forecast) → "It is decidedly so"; "Should I invest in this stock?" (company bankrupt) → "My sources say no"; "Will I pass the exam?" (studied hard) → "It is decidedly so". All contextually sensible, all varied.

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
- [x] All 20 canonical phrases are reachable in principle (7 distinct phrases observed across ~9 test calls so far, spanning affirmative/non-committal/negative)
- [x] No malformed/unmapped answer ever reaches the UI (structurally guaranteed: `jev.ts` throws if the returned key isn't in the 20-answer map, caught and turned into a 502 the client renders as an error, never garbage text)

**Verification:**
- [x] Manual check, all 4 edge cases against the live proxy:
  - Empty background ("Is she interested in me?") → "Reply hazy, try again" (0.8 confidence)
  - Very short question, no background ("Luck?") → "Reply hazy, try again"
  - Deliberately self-contradictory background → "Reply hazy, try again" (0.9 confidence — correctly read as unresolvable, not an arbitrary pick)
  - ~4,800-word background with a clear signal buried in repetitive filler → correctly extracted the actual signal ("My sources say no" for a "will it rain" question whose background concluded "no rain expected"), no errors, cost scaled proportionally ($0.00025 vs. ~$0.00003 for short calls)

**Dependencies:** Task 4

**Files likely touched:**
- `proxy/src/jev.ts`
- `android/app/src/main/java/.../network/ProxyClient.kt`

**Estimated scope:** S

---

## CHECKPOINT: Core flow proven (after Tasks 4–5)
- [x] Typing a question, tapping the stand-in "Ask" button, and seeing one of the exact 20 canonical phrases render works on the emulator, backed by a real Jev call
- [x] This is the point where the hardest technical risk is retired — review with Avi before investing in visual polish

---

## Task 6: Ball visual + tap gesture + reveal animation

**Description:** Replace the placeholder "Ask" button with a tappable ball composable. Add a brief "shaking/thinking" animation while the request is in flight, and an answer-reveal animation (text appears in a windowed area on the ball, echoing the classic 8-ball reveal) once the response arrives.

**Acceptance criteria:**
- [x] Tapping the ball (not a separate button) triggers the same flow built in Task 4
- [x] A visible animation plays during the network call, distinct from the idle state (rotation wobble via `graphicsLayer`, idle state has its own gentle breathing-scale animation)
- [x] The answer appears via a reveal animation, not an instant text swap (`AnimatedContent` cross-fade in the ball's window)

**Verification:**
- [x] Manual check: ran multiple full flows on the emulator via adb input + screenshots — idle → typed question/background → tapped ball → thinking → answer, all rendering correctly including long phrases like "Concentrate and ask again" wrapping cleanly in the window

**Dependencies:** Task 4

**Files likely touched:**
- `android/app/src/main/java/.../ui/BallComposable.kt` (new)
- `android/app/src/main/java/.../MainScreen.kt`

**Estimated scope:** M

---

## Task 7: Basic 3D rendering spike for the ball

**Description:** Per PRD Section 10, try rendering the ball with a lightweight 3D approach (Filament/SceneView) first, timeboxed. If it's too heavy to get looking good within the timebox, fall back to a well-shaded pseudo-3D illustration (gradients/specular highlights on a Canvas-drawn sphere). Whichever approach ships, the result must diverge from Mattel's specific trade dress (PRD Section 7): no "Magic 8 Ball" wordmark, no exact blue-liquid-triangle-window replica.

**Decision made:** skipped the Filament/SceneView attempt entirely and went straight to shaded-2D. A single static sphere with two simple animations doesn't justify pulling in a full 3D engine, model assets, and native library integration — that complexity wouldn't be earning its keep. Flagged this deviation from the plan's literal sequencing to Avi rather than silently skipping the spike step.

**Acceptance criteria:**
- [x] The ball reads as "3D-ish" and good-looking, not flat/placeholder (radial gradient with an offset highlight + a thin amber rim-light stroke, drawn in `Canvas`)
- [x] Visual design does not reproduce Mattel's specific color scheme/window shape/wordmark (dark charcoal/amber palette, no wordmark, no blue liquid window)
- [x] Approach taken noted in `PRD.md` Section 10

**Verification:**
- [x] Manual visual check on the emulator via screenshots — reads as a convincing lit sphere
- [x] Compared conceptually against Mattel's Magic 8-Ball: different color scheme entirely (warm dark/amber vs. blue/white), no wordmark, no liquid-filled window illusion — judged sufficiently diverged

**Dependencies:** Task 6

**Files likely touched:**
- `android/app/src/main/java/.../ui/BallComposable.kt`
- `android/app/src/main/res/...` (3D model asset or drawable resources)

**Estimated scope:** M (spike — timebox before starting; fall back rather than let this run long)

---

## Task 8: Network-failure handling ("needs internet")

**Description:** Handle the case where the proxy call fails (no network, timeout, proxy error, rate-limit rejection). Show an explicit "needs internet"-style message per PRD Section 8. Must not crash and must not substitute a fake local answer.

**Acceptance criteria:**
- [x] Airplane mode → tap ball → clear error message shown, no crash
- [x] Proxy returning an HTTP error is handled the same way, not treated as a valid answer

**Verification:**
- [x] Manual check: disabled wifi/data + airplane mode on the emulator (the `airplane_mode_on` setting alone didn't cut actual connectivity — a known emulator quirk — so used `svc wifi disable` / `svc data disable` / `cmd connectivity airplane-mode enable` instead); confirmed "needs internet" renders with no crash, then restored connectivity and confirmed a real call works again
- [x] Manual check: sent malformed JSON to the live proxy, found it returned an unhandled-exception 500 page instead of a clean error — fixed by wrapping the `request.json()` parse in try/catch, redeployed, confirmed it now returns a clean `400 {"error":"invalid JSON body"}`

**Dependencies:** Task 6

**Files likely touched:**
- `android/app/src/main/java/.../network/ProxyClient.kt`
- `android/app/src/main/java/.../MainScreen.kt`

**Estimated scope:** S

---

## CHECKPOINT: v0 UX complete (after Tasks 6–8)
- [x] Full user-facing flow (question → background → tap ball → thinking animation → answer reveal) feels right on the emulator
- [x] Airplane-mode test shows the error message without crashing
- [ ] Review with Avi before proceeding to release-readiness tasks

---

## Task 9: Rate limiting / abuse prevention on the proxy

**Description:** Add a per-IP (or per-device, if a lightweight device identifier is easy to add) daily request cap to the Worker, using Cloudflare KV or a Durable Object as the counter store. This is a hard requirement for a public app fronting a shared paid key (PRD Section 8), not optional polish.

**Decision:** per-IP, not per-device — there's no accounts/login system, so IP (via Cloudflare's `cf-connecting-ip` header) is the practical stand-in for "user." Cloudflare's native Workers rate-limiting binding only supports 10s/60s windows (verified against current docs), not a daily one, so the daily cap is hand-rolled: a KV counter keyed by `${ip}:${YYYY-MM-DD}`, incremented per request, with a 25-hour TTL so old keys self-clean. Not billing-grade atomic (KV is eventually consistent across edge locations), an acceptable trade for a 50/day novelty cap versus Durable Objects' complexity.

**Acceptance criteria:**
- [x] Requests past the configured daily cap are rejected with a clear error (`429 {"error":"daily limit reached"}`), not silently dropped or passed through
- [x] Cap is configurable (single `DAILY_LIMIT` constant in `rateLimit.ts`), not hardcoded in multiple places

**Verification:**
- [x] Manual check: rather than burning 50 real Jev calls, set my own IP's counter directly via `wrangler kv key put` to 49, then confirmed request #50 succeeds (200) and #51 is blocked (429) — exact boundary confirmed, then reset the counter afterward
- [x] Confirmed current Workers KV free-tier limits before committing to this approach (100k reads/day, 1,000 writes/day) — fine for expected usage, worth knowing as a ceiling if this ever gets real traffic

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
