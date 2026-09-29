# Implementation Plan: Hunch8 Web (PWA)

Spec: [`web/SPEC.md`](../web/SPEC.md). Task details: [`tasks/todo-web.md`](todo-web.md). The Android plan in `plan.md` and `todo.md` is untouched.

## Overview

A faithful PWA copy of the Android app in `web/`, calling the existing Worker. The riskiest unknowns come first:

1. The Worker must accept browser calls (CORS).
2. The ask flow must work end to end before any visual work starts.
3. The Compose ball has to be ported to Canvas and look the same, which is where most of the effort and risk sits.

After that: screen parity, the PWA features (installable, works offline), and finally automated deploys.

## Architecture Decisions

- **Four PRs, each leaving `main` working:**
  - **PR 0** `feat/proxy-cors`: CORS on the Worker, then deploy the Worker.
  - **PR 1** `feat/web-skeleton`: scaffold, proxy client, a plain placeholder UI, E2E tests on mocks, and CI (tests only).
  - **PR 2** `feat/web-ball`: the Canvas ball port.
  - **PR 3** `feat/web-pwa`: screen parity, icons, manifest, service worker, and the **deploy job**.

  The deploy job only arrives in PR 3, so merging PRs 1 and 2 can never publish a half-built app.
- **Walking skeleton before the ball.** PR 1 proves question → Worker → answer → state with a plain button and text, the same approach the Android plan used.
- **The Kotlin code is the reference for visuals** (spec: port rules). Every drawing constant is copied from `BallComposable.kt` under the same name.
- **E2E always uses mocks.** `page.route` fakes the Worker, so CI never spends quota or money. The only real call is one manual smoke test after deploy.
- **`ALLOWED_ORIGINS` = `https://hunch8.pages.dev,http://localhost:5173`.** The localhost entry lets `npm run dev` talk to the real Worker. That's harmless, since anyone able to use it could curl the Worker anyway.

## Task List

### PR 0: Worker CORS
- [x] Task 1: Apply the CORS change to `proxy/` (from `docs/proxy-cors-for-web.md`). PR [#1](https://github.com/aohana182/hunch8/pull/1)
- [ ] Task 2: Deploy the Worker and verify CORS in production

### Checkpoint 0
- [ ] Preflight from `https://hunch8.pages.dev` gets `Access-Control-Allow-Origin`, and a preflight from other origins doesn't
- [ ] The Android app still answers a question

### PR 1: Walking skeleton
- [x] Task 3: Scaffold `web/` (Vite, TypeScript, test runners)
- [x] Task 4: Proxy client and ball state machine, test-first
- [ ] Task 5: Placeholder UI wired end to end, plus E2E tests for all four outcomes
- [ ] Task 6: CI workflow, test job only, on PRs and `main`

### Checkpoint A
- [ ] `npm test`, `typecheck`, `e2e` and `build` are green locally and in CI on the PR
- [ ] `npm run dev` against the real Worker returns a real phrase (manual, one question)
- [ ] Review with the Android author, then merge

### PR 2: The ball
- [ ] Task 7: Animation primitives (easing, tween, damped spring), test-first
- [ ] Task 8: Static ball drawing (sphere, "8", window, shading, gloss, shadow)
- [ ] Task 9: Ball states and motion (flip, reveal, bob, shake, triangles, ✕), replacing the placeholder

### Checkpoint B
- [ ] Idle and answered screenshots next to `assets/screenshot-*.png`: the Android author confirms they match
- [ ] All E2E tests still green, with a screenshot of each state in the report
- [ ] Review, then merge

### PR 3: Parity, PWA and deploy
- [ ] Task 10: Screen parity: header, help dialog (with Privacy and Disclaimer links), text field, draft kept in `sessionStorage`, responsive layout
- [ ] Task 11: Icons from the screenshot, manifest, iOS meta tags
- [ ] Task 12: Service worker: the app opens offline and shows "App not responding" when asked
- [ ] Task 13: One-time deploy setup: Pages project, repo secrets (the Android author), `production` environment
- [ ] Task 14: Deploy job on `main`, plus docs (`web/README.md`, and short pointers in the root `README.md` and `AGENTS.md`)

### Checkpoint C: Done
- [ ] Merge deploys to `https://hunch8.pages.dev` with no manual step
- [ ] A real question on the live site returns a phrase
- [ ] Installs and launches full-screen on a real Android phone and a real iPhone
- [ ] All spec success criteria (1–9) are checked off

## Parallelization

Task 1 (proxy) and Tasks 3–4 (scaffold, client) don't depend on each other. Task 7 (animation maths) and Task 8 (drawing) are also independent. Everything else runs in order.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The Canvas port doesn't look like the Compose ball, mostly because of text metrics for the "8" and the answers | High | Constants are ported by name, not eyeballed. Checkpoint B is a side-by-side review by the Android author before anything else builds on the ball. |
| The spring wobble feels different | Medium | Real damped-spring simulation using Compose's parameters, unit-tested for overshoot and settle time. |
| iOS Safari PWA quirks: `100vh` with the keyboard, standalone mode, icon and service worker behavior | Medium | Use `dvh` units, `apple-touch-icon` and `apple-mobile-web-app-*` meta tags, WebKit in the E2E matrix, and a real-iPhone check at Checkpoint C. |
| Blurry canvas on high-density screens | Medium | Size the canvas backing store by `devicePixelRatio`. Checked on desktop and phone. |
| `hunch8` is taken as a Pages name | Low | Fall back to `hunch8-web` and update `ALLOWED_ORIGINS` in the same step (Task 13 happens before Task 2's final value matters). |
| Repo secrets can only be added by the owner | Low | Only Task 14's first deploy is blocked. Ask the Android author early, during PR 1. |
| A stale service worker serves an old app after a deploy | Medium | Page loads are network-first, the cache name changes per build, and old caches are deleted on activate. Task 12 tests an update. |

## Open Questions

- Is the Android author OK with small additions to the root `README.md` and `AGENTS.md` (a "Web" line and the `web/` structure)? Proposed: yes, in Task 14.
