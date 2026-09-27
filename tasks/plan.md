# Implementation Plan: Hunch8 v0

## Overview

v0 delivers the full Hunch8 pipeline with the simplest possible trigger: tap the ball, send question + background to Jev through a backend proxy, get back one of the 20 canonical 8-ball answers, and show it with an 8-ball-style reveal. No shake gesture, no answer history, no monetization — those are out of scope per `../PRD.md` Section 9/13. The riskiest unknown (does the Jev/OpenRouter integration actually work end-to-end) is front-loaded into Phase 2 as a bare-bones walking skeleton before any visual polish, so failure there is caught early and cheaply.

## Architecture Decisions

- **Two repos-in-one, one project folder:** `hunch8/proxy` (Cloudflare Worker, TypeScript) and `hunch8/android` (Kotlin + Jetpack Compose app), per PRD Section 10.
- **Proxy holds the OpenRouter API key**, never the client — this is a public Play Store app, so key exposure is a real cost risk, not a theoretical one (PRD Section 7).
- **Walking skeleton before polish:** build the ugliest possible working version of the full pipeline (plain button, plain text answer) before touching the ball's visuals or animations, so the Jev integration is proven before time is spent on rendering.
- **Rate limiting ships in v0**, not deferred — PRD Section 8 treats it as non-negotiable given the shared-key public-app cost model.
- **3D ball rendering approach is a spike, not a commitment** (Task 7): try Filament/SceneView first; fall back to a shaded-2D Canvas illustration if that proves too heavy for the timebox. Whichever looks better and ships faster wins.

## Task List

### Phase 1: Foundation

- [x] Task 1: Scaffold the Android app shell
- [x] Task 2: Scaffold the Cloudflare Worker proxy shell
- [x] Task 3: Implement the real Jev call in the proxy

### Checkpoint: Foundation
- [x] Proxy deployed and returns a real Jev-backed answer when hit with `curl`
- [x] Android app builds and runs an empty shell on the emulator
- [ ] Review with Avi before proceeding to Phase 2

### Phase 2: Core vertical slice (walking skeleton)

- [x] Task 4: Wire the app to the proxy with placeholder UI
- [x] Task 5: Confirm the 20-answer contract end-to-end

### Checkpoint: Core flow proven
- [x] Typing a question, tapping the stand-in "Ask" button, and seeing one of the exact 20 canonical phrases render, works on the emulator, backed by a real Jev call
- [ ] Review with Avi before proceeding to Phase 3 (this is the point where the hard technical risk is retired)

### Phase 3: v0 UX

- [x] Task 6: Ball visual + tap gesture + reveal animation
- [x] Task 7: Basic 3D rendering spike for the ball
- [x] Task 8: Network-failure handling ("needs internet")

### Checkpoint: v0 UX complete
- [x] Full user-facing flow (question → background → tap ball → thinking animation → answer reveal) feels right on the emulator
- [x] Airplane-mode test shows the error message without crashing
- [ ] Review with Avi before proceeding to Phase 4

### Phase 4: Public-release readiness

- [x] Task 9: Rate limiting / abuse prevention on the proxy
- [ ] Task 10: Attribution screen ("powered by Jev")
- [ ] Task 11: Privacy policy screen + link

### Checkpoint: Release-ready
- [ ] Burst of requests past the proxy's cap gets throttled (manually verified)
- [ ] No API key anywhere in the built APK (spot-checked via `apktool` or similar)
- [ ] Privacy policy present and linked
- [ ] All PRD Section 12 (v0) acceptance criteria met

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Jev's Decisions API is an alpha surface; schema could shift under us | High | Task 3 verifies the real request/response shape directly against the live API before any app code depends on it; re-check docs if the request fails unexpectedly rather than guessing |
| Jev per-token pricing was never confirmed (model page 404'd) | Medium | Confirm live pricing during Task 3 when the API key is in hand and the model page is reachable with auth; don't ship without knowing real cost-per-use |
| 3D rendering (Filament/SceneView) may be heavier than a "basic 3D" ball needs | Medium | Task 7 is timeboxed as a spike with a shaded-2D fallback already agreed in the architecture decision — no open-ended exploration |
| Public app + shared paid key without rate limiting = unbounded cost exposure | High | Task 9 is in the release-readiness checkpoint, not deferred; Checkpoint 4 explicitly re-verifies it before calling v0 done |
| Trademark/trade-dress risk on the ball's visual design | Medium | Task 6/7 explicitly follow PRD Section 10's line (no wordmark, no exact color/window replica) — flag for a visual review before finalizing art |

## Open Questions

- Backend proxy platform: Cloudflare Workers is the proposed default (PRD Section 10) — confirmed unless Avi objects during Task 2.
- Exact 3D rendering approach: resolved by the Task 7 spike, not before.
