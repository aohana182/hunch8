# Hunch8 — Product Requirements Document

Status: Draft v1 — pending sign-off on Section 10 (architecture) and Section 11 (open decisions) before any code is written.

## 1. One-line pitch

Ask a question, give it some background, trigger the ball, and Hunch8 locks in a gut call — one of the 20 classic magic-ball answers — chosen by TypeSafe's Jev decision model (via OpenRouter) instead of a coin flip. v0 triggers on a tap; v0.1 adds a phone shake as an alternate trigger.

## 2. Name & positioning

- **App name:** Hunch8
- **Why it works:** "Hunch" = the pre-existing gut belief the app is reinforcing (rooted in HST's gambling/Vegas/Kentucky Derby writing, where "hunch" is the literal term for trusting instinct over odds); "8" carries the 8-ball reference. Short, easy to say, no HST name/likeness/copyrighted-title usage.
- **Tone:** irreverent, confident, a little unhinged — gonzo-adjacent attitude, not literal HST branding.
- **Jev/TypeSafe:** never used as the public app name or headline branding. Credited only as a small "powered by" attribution (see Section 7) — the model's own docs are a third party's product, not ours to brand around.

## 3. Why this is different from a generic 8-ball app

Classic 8-ball apps pick uniformly at random. Hunch8 sends the user's actual question + background context to Jev, which returns a **Choice** decision (one of the 20 canned answers) with per-option probabilities and a confidence score. The answer is still always one of the 20 fixed phrases — Jev is doing the picking, not generating new text — but the pick is informed by what the user actually typed, so it feels like a real (if fake) hunch rather than a coin flip.

## 4. Core user flow

**v0 (trigger = tap):**

1. User opens the app → sees two fields: **"What's the question?"** (short, required) and **"Give it some background"** (longer free text, optional but encouraged), with the ball rendered below/beside them.
2. User taps the ball.
3. App shows a brief "shaking ball" animation + haptic feedback while the request is in flight.
4. App calls Jev (via the backend proxy) with a single `choice` question whose 20 options are the canonical 8-ball answers, and `state` = question + background.
5. Jev returns the selected answer + probabilities + confidence.
6. App reveals the answer with an 8-ball-style animation (text floats up in the triangle window).
7. User can tap again to re-ask, or start a new question.

**v0.1 (roadmap):** add physical shake as an alternate trigger, using the same steps 3–7 — see Section 13 (Roadmap).

## 5. The 20 answers (canonical Magic 8-Ball set — generic public-domain phrases, not reused branding/art)

**Affirmative (10):** It is certain · It is decidedly so · Without a doubt · Yes, definitely · You may rely on it · As I see it, yes · Most likely · Outlook good · Yes · Signs point to yes

**Non-committal (5):** Reply hazy, try again · Ask again later · Better not tell you now · Cannot predict now · Concentrate and ask again

**Negative (5):** Don't count on it · My reply is no · My sources say no · Outlook not so good · Very doubtful

## 6. Jev integration — technical design

Grounded directly in OpenRouter's Jev docs (fetched 2026-09-27); verify against live docs again before implementation since this is an alpha surface.

**Public release means the Android app never talks to OpenRouter directly.** The app calls a small backend proxy you control; the proxy holds the OpenRouter API key server-side and forwards the call to Jev. This is the only safe way to ship a single shared key in a publicly-distributed app — a key embedded in the client APK is trivially extractable by decompiling it, and since Jev bills per input token, an extracted key is a direct, unbounded cost exposure on your OpenRouter account.

```
Android app  →  your backend proxy (holds the API key)  →  OpenRouter Decisions API  →  Jev
```

- **Model:** `typesafe/jev-1.13`, or the `~typesafe/jev-latest` alias
- **Endpoint (called by your proxy, not the app):** `POST https://openrouter.ai/api/alpha/decisions`
- **Auth:** standard OpenRouter API key, Bearer header, held only in the proxy's server-side config/secrets — never sent to or stored on the device
- **Context limit:** 32,000 tokens (question + background + instructions all count)
- **Pricing:** billed per input token at the rate on Jev's model page; output tokens are free; every response includes `usage.cost` in USD. **Exact per-token price was not independently confirmed** (the model page 404'd on fetch) — check `https://openrouter.ai/typesafe/jev-1.13` directly before shipping, don't hardcode an assumed number.

**Request shape:**
```json
{
  "model": "typesafe/jev-1.13",
  "state": "<question> + <background>",
  "questions": {
    "answer": {
      "type": "choice",
      "instructions": "Pick the 8-ball answer that best fits the asker's question and background. Commit to one — don't hedge.",
      "criteria": {
        "it_is_certain": "Fits when the background strongly supports a confident yes",
        "reply_hazy": "Fits when the background is too thin or contradictory to call",
        "my_reply_is_no": "..."
        /* one entry per of the 20 canonical answers */
      }
    }
  }
}
```

**Response shape (choice type):**
```json
{
  "answer": {
    "type": "choice",
    "choice": "it_is_certain",
    "probabilities": { "it_is_certain": 0.41, "reply_hazy": 0.12, "...": "..." },
    "confidence": 0.63
  },
  "usage": { "cost": 0.00021 }
}
```

- App maps the returned `choice` key back to its display string (the 20 keys ↔ 20 phrases mapping lives client-side, not sent as free text each time — cheaper and avoids Jev inventing off-list wording).
- `confidence` is available for optional UI flourish (e.g., a more dramatic animation on high confidence) — not required for v1.

## 7. Must-nots

- **No API key anywhere in the client APK, ever.** Confirmed as a hard requirement — this is a public Play Store release, so the OpenRouter/Jev key lives only in the backend proxy's server-side secrets.
- **No public branding around "Jev" or "TypeSafe."** App name and store listing stay "Hunch8"; Jev is credited only in a small "powered by" line/about screen.
- **No exact reproduction of Mattel's Magic 8-Ball trade dress or wordmark.** You asked for the visual design to get as close to the original *feel* as possible without crossing into trademark/trade-dress territory — see Section 10 for the specific line being drawn. The generic concept of a fortune-telling ball toy isn't ownable; the "Magic 8 Ball" name and Mattel's specific logo/font are.
- **No logging/persisting the user's question or background text server-side** beyond what's needed for the single API call — it's arbitrary user text going to a third party (your proxy → OpenRouter → TypeSafe), and Play Store requires disclosure of that regardless (see Section 9).
- **No faking an answer that contradicts what Jev returned.** If confidence is low, still show Jev's actual pick — don't silently substitute a "safer" local answer.
- **No unbounded proxy usage.** Since the proxy's OpenRouter key is shared across every install, an unthrottled public endpoint is an open invitation to run up your bill — see Section 8's abuse-prevention requirement.

## 8. Must-do

- **v0:** tap target on the ball itself (not a separate button) that triggers the ask, with a debounce (~1–2s) so a rapid double-tap doesn't double-fire.
- Visible "thinking" state while the network call is in flight (it is not instant).
- On network failure or API error: show an explicit **"Needs internet"**-style message. Do not crash, and do not silently fall back to a fake local answer.
- **Abuse prevention on the proxy**, since it's a public app fronting a shared paid key. At minimum: per-device/per-IP rate limiting (e.g., a sane daily cap on requests). Recommended: Play Integrity API (or Firebase App Check) so the proxy only serves requests that actually came from your signed app, not a script hitting the endpoint directly. Exact mechanism is an implementation-time decision, but "some throttle exists before launch" is non-negotiable given the cost model.
- Settings/about screen showing "powered by Jev (TypeSafe, via OpenRouter)" attribution.
- A privacy policy screen/link, required by Play Store since user-entered text is sent to a third-party API.

## 9. Out of scope (v1)

- Voice input
- Sharing / multiplayer
- Accounts, auth, cloud sync
- Multiple languages / alternate answer sets
- Monetization (none for now — Section 11)

## 10. Architecture (confirmed)

- **Platform:** native Android, Kotlin + Jetpack Compose
- **Min SDK:** API 26 (Android 8.0+) — my call, standard modern-Android floor, revisit only if a specific older device needs support
- **Networking:** OkHttp/Retrofit calling your own backend proxy (not OpenRouter directly)
- **Backend proxy:** a small serverless function — proposing **Cloudflare Workers** (generous free tier, trivial to deploy, holds the OpenRouter key as a secret, does the rate-limiting/attestation check, forwards to `https://openrouter.ai/api/alpha/decisions`, returns the parsed answer). Firebase Cloud Functions is an equally valid alternative if you'd rather stay in that ecosystem. Flag now if you want a different choice — otherwise I'll proceed with Cloudflare Workers.
- **Trigger, v0:** a tap gesture on the ball composable — no sensor code at all in v0.
- **Trigger, v0.1 (roadmap):** `SensorManager` + accelerometer, shake detection via magnitude-delta threshold over a short rolling window, added alongside (not replacing) the tap trigger. This SDK setup available on the dev machine already has an Android emulator (with existing AVDs) whose console supports faking accelerometer input via `adb emu sensor set acceleration <x>:<y>:<z>` — enough to iterate the threshold/debounce logic without a physical device, though final UX tuning (how hard a real shake needs to be, avoiding false positives from normal handling) still wants a real phone.
- **Local storage:** DataStore for settings only (no answer history per Section 11) — no on-device API key, ever
- **No user-facing key entry UI** — the app ships with only the proxy's URL baked in, which is not a secret

**Visual direction (per your answer to Section 11.6):** basic 3D rendering, aiming as close to the classic 8-ball *feel* as possible — a dark sphere, a windowed readout where the answer appears, a shake/settle animation — while deliberately diverging from Mattel's specific trade dress: no "Magic 8 Ball" wordmark or logo, no exact color/liquid-window replica (e.g., an original color treatment or window shape rather than the specific blue-liquid triangle window), and no packaging/branding lookalike. Proposing a lightweight 3D approach via **Jetpack Compose + a simple 3D model rendered with Filament (Google's SceneView library)** or, if that's too heavy, a well-shaded pseudo-3D illustration (gradients/specular highlights on a Canvas-drawn sphere) that reads as "3D-ish" without a full 3D engine. Actual choice between real-3D vs. shaded-2D-that-reads-as-3D is worth revisiting once we're implementing and can see how it looks.

**Alternative considered:** Flutter/cross-platform — not recommended since this is Android-only per your ask, and native keeps the shake-sensor handling simplest.

## 11. Decisions log

| # | Decision | Resolution |
|---|----------|------------|
| 1 | API key model | Shared key, held server-side in a backend proxy (required — this is a public Play Store release, so no key can ever ship in the client). You will supply the OpenRouter API key for the proxy's config. |
| 2 | Min SDK | API 26 (Android 8.0+), engineering's call. |
| 3 | Answer history | No history in v1. |
| 4 | Offline/error fallback | Explicit "needs internet" error message. No crash, no fake fallback answer. |
| 5 | Monetization | None for now. **Cost risk flag:** a public app with no monetization and a shared paid-per-token key means all Jev usage cost lands on your OpenRouter account with no revenue offset — the rate-limiting in Section 8 is what keeps that bounded, not optional polish. |
| 6 | Visual direction | As close to the classic 8-ball feel as possible without crossing into Mattel trademark/trade-dress territory; basic 3D, must look good. See Section 10 for the specific approach and the line being drawn. |

**Still open / flag if you disagree:** the exact 3D rendering approach (real 3D engine vs. shaded pseudo-3D) — cheap to change, so I'll proceed with the proposed default unless you say otherwise.

**Backend proxy platform — confirmed:** Cloudflare Workers, explicitly chosen over using your existing VPS. You don't want to expose the VPS (which also runs your Hermes agent fleet) to public internet traffic from this app, so Workers stays isolated on its own infrastructure with no new attack surface on anything you already run.

## 12. Acceptance criteria — how we'll know it's done

**v0:**
- Cold app open → enter question + background → tap the ball → app calls the backend proxy → proxy calls Jev → one of the exact 20 canonical phrases renders within a few seconds. Fully testable on the emulator, no physical device required.
- Airplane-mode test: app shows the "needs internet" message without crashing.
- No API key present anywhere in the client APK — spot-checked via `apktool` or similar before any public release.
- Proxy rate-limiting/abuse-prevention verified working (e.g., confirm a burst of requests past the cap gets throttled) before public release.
- Privacy policy is written, linked from the app, and linked from the Play Store listing before any public release.
- Real per-token Jev pricing confirmed from the live model page (not the number assumed in this doc, since that fetch failed) before launch, so cost-per-use is actually known.

**v0.1 (shake):**
- Simulated shake via `adb emu sensor set acceleration` reliably triggers the same flow as a tap, with correct debounce (no double-fire from one shake gesture).
- Confirmed on a **real device** that a natural hand shake triggers reliably, and that normal phone handling (walking, picking it up) does not false-trigger.

## 13. Roadmap

- **v0:** tap-to-ask, full Jev pipeline through the backend proxy, the 20 canonical answers, basic 3D ball, privacy policy, rate-limited proxy. This is the whole product minus the gesture.
- **v0.1:** add phone-shake as an alternate trigger alongside the tap (not a replacement) — self-contained addition, doesn't touch the pipeline built in v0.
- **Later / unscheduled:** answer history, monetization, alternate visual themes — all explicitly out of scope until revisited (Section 9).

## Sources

- https://openrouter.ai/docs/guides/community/jev (fetched 2026-09-27)
- https://openrouter.ai/docs/guides/community/jev-tutorial (fetched 2026-09-27, partial)
- https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request (fetched 2026-09-27)
- Model pricing page (`https://openrouter.ai/typesafe/jev-1.13`) — fetch failed (404), unverified, flagged above as an open item
