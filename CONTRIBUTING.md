# Contributing to Hunch8

Thank you for contributing to Hunch8! This document outlines our setup, workflows, and contribution standards across the Proxy, Web (PWA), and Android app.

## Quick Setup

Clone the repository:
```sh
git clone https://github.com/aohana182/hunch8.git
cd hunch8
```

### 1. Cloudflare Worker Proxy
```sh
cd proxy
npm install
npm test
```

### 2. Web App (PWA)
```sh
cd web
npm install
npm test
npm run typecheck
npm run build
```

### 3. Android App
Requires JDK 17+ and the Android SDK:
```sh
cd android
./gradlew assembleDebug
```

---

## Local Development Without an API Key (Mock Proxy)

You do **not** need an OpenRouter account or Cloudflare KV setup to test Web or Android changes locally. Run our local mock proxy:

```sh
node scripts/mock-proxy.mjs
# or from proxy directory:
cd proxy && npm run dev:mock
```
This runs a local server at `http://localhost:8787` that returns valid classic 8-ball answers with simulated latency, and supports test triggers (e.g. questions containing "rate limit", "block", or "error").

- **Web:** Set `VITE_PROXY_URL=http://localhost:8787` in `web/.env.local` or launch Vite with `npm run dev`.
- **Android:** Set `hunch8.proxyUrl=http://10.0.2.2:8787` in `android/local.properties` (for Android emulator).

---

## Workflow

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes and run the test checks below
3. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat(scope): description`
4. Open a Pull Request against `main`

### Commit Message Format
```
type(scope): subject (max 72 chars)

- What changed
- Why it matters
- How verified
```
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

---

## Checks Before Submitting a PR

Run the checks matching the components you touched:

- **Proxy:**
  - `cd proxy && npm test` — unit test suite
  - `cd proxy && npx tsc --noEmit` — type-check
- **Web:**
  - `cd web && npm test` — unit tests
  - `cd web && npm run typecheck` — TypeScript check
  - `cd web && npm run build` — production build
  - `cd web && npm run e2e` — Playwright end-to-end suite
- **Android:**
  - `cd android && ./gradlew assembleDebug` — ensure app compiles
- **Visual / UI Changes:**
  - Attach a screenshot or recording to your PR description.

---

## Important Rules

- **Never commit secrets or API keys.** The OpenRouter key belongs only in `proxy/.dev.vars` (gitignored) or Cloudflare secrets (`wrangler secret put`), never in tracked files or client code.
- **Classic phrases only.** Answers must remain strictly within the 20 classic Magic 8-Ball phrases.
- **Trace documentation.** If you modify Jev instructions or score bands, document evaluation runs in `evals/traces.md`.
- **Security vulnerabilities.** If you find a security issue, refer to our [Security Policy](SECURITY.md) for private disclosure instructions.
