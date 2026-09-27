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
- [x] Build/deploy succeeds: `wrangler deploy` — live at https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev
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
- [x] Proxy deployed and returns a real Jev-backed answer via `curl`/fetch (https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev)
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

**Folded into the help popup (2026-09-27)** rather than a separate about screen: the original 4-bullet help dialog explained *how* to use the app but never mentioned Jev at all — missing the entire point of the app being built on a real decision model, not a random picker. Added a "Powered by Jev" section to the same `HelpDialog` (`MainScreen.kt`) with attribution plus a short explanation of what Jev actually is (a Score-based decision model, not a chatbot). This satisfies the attribution requirement without a second screen to navigate to.

**Acceptance criteria:**
- [x] The attribution text ("powered by Jev... via OpenRouter") is reachable from the main screen
- [x] Explains what Jev is, not just that it's used — this was the actual point of the requirement, not just a legal credit line

**Verification:**
- [x] Manual check: opened the help popup on the emulator, confirmed the "Powered by Jev" section renders correctly below a divider, full text legible

**Dependencies:** Task 1

**Files touched:**
- `android/app/src/main/java/com/hunch8/app/MainScreen.kt` (`HelpDialog`)

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

## Task 12: App icon and launcher branding

**Description:** Design/produce real launcher icon assets (adaptive icon: foreground + background layers) matching Hunch8's actual visual identity (dark ball, amber accent, navy background), replacing the current default Android icon — the one visible briefly during the splash screen today.

**Acceptance criteria:**
- [ ] Real launcher icon shows in the app drawer and during the open-app splash — no more generic Android robot placeholder
- [ ] Icon reflects the app's actual identity, not a generic shape

**Verification:**
- [ ] Manual check: install and confirm the icon renders correctly in the launcher and splash on the emulator

**Dependencies:** None

**Files likely touched:**
- `android/app/src/main/res/mipmap-*/`
- `android/app/src/main/AndroidManifest.xml`

**Estimated scope:** S–M (mostly asset creation, not logic)

---

## Task 13: Release signing and Play Console setup

**Description:** Generate a real release keystore (owned by Avi — never committed to git), add a release signing config to Gradle, and enroll in Play App Signing. Separately, fill in the Play Console's Data Safety form (declaring that question text is sent to a third-party API — OpenRouter/TypeSafe) and the content rating questionnaire. Most of this is account/ownership work only Avi can do; the Gradle signing config can be scaffolded once a keystore exists.

**Acceptance criteria:**
- [ ] Release build is signed with a real key, not the debug keystore
- [ ] Play Console Data Safety form accurately reflects what the app actually sends
- [ ] Content rating questionnaire completed

**Verification:**
- [ ] Manual check: `./gradlew bundleRelease` produces a signed, installable release artifact

**Dependencies:** None (needs Avi to own the Play Console account and the keystore)

**Files likely touched:**
- `android/app/build.gradle.kts` (signing config)
- a new, gitignored keystore file

**Estimated scope:** M (mostly admin work, not code)

---

## Task 14: Play Integrity API hardening

**Description:** Add Play Integrity API (or Firebase App Check) attestation so the proxy only serves requests that actually came from the signed app, tightening the current per-IP rate limit against a script hitting the proxy endpoint directly (bypassing the app entirely).

**Acceptance criteria:**
- [ ] Proxy rejects requests without a valid attestation token once enabled
- [ ] Legitimate app requests are unaffected

**Verification:**
- [ ] Manual check: a raw script request to the proxy without an attestation token is rejected

**Dependencies:** Task 9

**Files likely touched:**
- `proxy/src/index.ts`
- Android client (attestation token generation)

**Estimated scope:** M

---

## Task 15: Guard against oversized input

**Description:** Jev's context window is 32,000 tokens. Nothing currently stops a user from pasting something huge into the single input field, which would fail on Jev's side rather than being caught gracefully client-side.

**Acceptance criteria:**
- [ ] The input field enforces a sane max character count, with visible feedback when hit
- [ ] Oversized input never reaches an ungraceful Jev API error

**Verification:**
- [ ] Manual check: paste a very long block of text and confirm it's handled (truncation or a friendly limit message), not a raw failure

**Dependencies:** Task 4

**Files likely touched:**
- `android/app/src/main/java/.../MainScreen.kt`

**Estimated scope:** S

---

## Task 16: Crash reporting

**Description:** Add basic crash reporting (Firebase Crashlytics or similar). Right now there is zero visibility into real-world crashes on users' devices — a public release with no observability means silent failures.

**Acceptance criteria:**
- [ ] A deliberately forced test crash appears in the crash reporting dashboard

**Verification:**
- [ ] Manual check: trigger a test crash and confirm it's captured

**Dependencies:** None

**Estimated scope:** S–M

---

## CHECKPOINT: Release-ready (after Tasks 9–16)
- [x] Burst of requests past the proxy's cap gets throttled (manually verified)
- [ ] No API key anywhere in the built APK (spot-checked via `apktool` or similar)
- [ ] Privacy policy present and linked
- [ ] Real launcher icon in place
- [ ] Release build signed with a real key, Play Console Data Safety + content rating filled in
- [ ] All PRD Section 12 (v0) acceptance criteria met
- [ ] Final review with Avi before this is considered v0-done

---

## Task 17: Fix state loss on rotation/process death

**Description:** `question`, `ballState`, `answerText`, `showHelp` used `remember`, not `rememberSaveable` — rotating the phone or Android reclaiming the app in the background lost everything, including an answer just received.

**Done:** switched all four to `rememberSaveable` (works with zero custom `Saver` — `BallState` is a Kotlin enum, which is `Serializable` by default). Added a `LaunchedEffect(Unit)` guard: a restored `THINKING` state means the process was killed mid-request, so the coroutine that would have completed it is gone — resets to `IDLE` rather than staying stuck forever.

**Verified:** typed a question, backgrounded the app, `adb shell am kill` on its real process (confirmed via empty `pidof`), relaunched via the launcher task (not a fresh `am start -n`, so it's a true process recreation, not just resuming an existing one) — the question text survived. The `THINKING`-recovery guard is reasoned-correct by inspection; the actual race window (process killed mid-network-call) is too short to reliably trigger via adb.

---

## Task 18: Unit tests for the score→phrase band mapping

**Description:** `phraseForScore` (`proxy/src/jev.ts`) is a pure function with hard-coded band boundaries and no automated coverage — every prior check was indirect, via live API calls.

**Done:** `proxy/src/jev.test.ts`, run via Node's native test runner (`node --test`, zero new dependencies — Node 24 strips TS type annotations natively, just needs the explicit `.ts` extension in the relative import). Covers exact band boundaries, out-of-range scores, that the random pick stays inside the right band, that every phrase in a band is reachable, and (added after Task 20 below) the confidence-override behavior. `npm test` script added; test files excluded from the Worker's own `tsc --noEmit` scope since they're never part of the deployed bundle.

**Extended (2026-09-27, per the test-driven-development skill's pyramid):** applying the pyramid honestly, `rateLimit.ts` — the actual 50/day cap — had zero automated coverage; it was only ever verified manually via live `wrangler kv key put`. Added `proxy/src/rateLimit.test.ts` using a real in-memory fake `KVNamespace` (preferred over a mock per the skill: exercises the real get/parse/compare/put logic, not method-call assertions). Covers the exact 50/51 boundary, sustained blocking past the limit, per-client isolation, and the `"unknown"` client-id fallback. Deliberately did **not** add a DI-based integration test for `index.ts`'s routing (would need `askJev` refactored to be injectable purely to enable the test) — that routing is already covered by extensive real manual traces across every status code path (`evals/traces.md` plus Task 8/9 verification), and forcing a refactor just to enable a test felt like over-engineering glue code for this project's size.

**Verified:** `npm test` — 11/11 passing (6 score-mapping + 5 rate-limiter).

---

## Task 19: Content moderation guardrail

**Description:** Avi asked for protection against inappropriate/hateful/racist questions, with a clear, distinct error rather than answering them.

**Done:** a second Jev question (`flagged`, a `noul` primitive) is asked in the same request as the normal score — no added latency or API call. `flagged.noul >= 0.5` throws `JevBlockedError` → proxy returns `422 {"error":"blocked"}` → app shows a bold red "✕" directly over the ball's "8" face (no flip/reveal — this is a refusal, not an answer, so it's deliberately a different visual language than the answer/rate-limit/error triangles). Separately tested 3 prompt-injection attempts trying to bypass the guardrail or force a favorable score — all failed; decided not to add anti-injection code given that evidence (see PRD Section 6.2).

**Verified:** end-to-end through the real deployed proxy and the real app on the emulator — a hateful question shows the red X, a normal question afterward still flows correctly back to a real answer. Full traces in `evals/traces.md` cases 12–14.

---

## Task 20: Fix confidence-blindness in the phrase mapping

**Description:** Found via `evals/traces.md` trace #9: a score in the top band produced "Without a doubt" while Jev's own `confidence` was 0.5 (coin-flip) — the mapping never looked at confidence, only score.

**Done:** confidence below 0.6 now forces the non-committal band regardless of score. Covered by 2 new unit tests (Task 18's suite) using the exact real confidence values from traces #9 and #14.

**Verified:** `npm test` passing; redeployed and spot-checked live.

---

## Roadmap — not yet scheduled (v0.1 and later)

Kept as a short list, not full task cards, since none of these are being actively worked yet — per the planning process, breaking these into full acceptance-criteria cards is premature until one is actually picked up.

- **Shake-to-ask (v0.1):** phone-shake as an alternate trigger alongside the tap, using the accelerometer (PRD Section 4/13). The tap-only v0 was a deliberate scope cut to prove the Jev pipeline first — this was always the planned next step, not a new idea.
- **Voice input:** let the user speak the question/context instead of typing it (Android's built-in speech-to-text). Not yet scoped in detail — would need a mic permission, a speech-recognition flow, and a decision on whether it replaces or supplements the text field.
- Answer history, monetization, alternate visual themes — already out of scope per PRD Section 9, unchanged.
