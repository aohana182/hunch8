# Implementation Plan: Security Hardening & Open Source Contribution

This document outlines the concrete implementation plan to address security weak spots and enhance open source contributor readiness for Hunch8 across the Proxy, Web PWA, Android App, and GitHub repository infrastructure.

---

## 1. Overview & Objectives

1. **Security Hardening**:
   - Defend against denial-of-wallet and compute exhaustion via payload size and strict type validation.
   - Prevent denial-of-service on shared fallback IPs.
   - Secure web assets and Android app transport (CSP, security headers, cleartext traffic disabled).
   - Fix GitHub Actions version anomalies and secure deployment configurations.
2. **Open Source Contributor Experience**:
   - Provide a formal security vulnerability reporting policy (`SECURITY.md`).
   - Add automated CI workflows for Proxy and Android test/build suites.
   - Introduce a local mock proxy so contributors can build and test without cloud credentials.
   - Streamline developer documentation and PR checklists.

---

## 2. Architecture & PR Breakdown

The plan is split into three focused, non-breaking pull requests:

```
PR 1: Security Hardening & Defense-in-Depth
  ├── Proxy input validation & payload constraints
  ├── Missing client IP handling
  ├── Web HTTP security headers (_headers)
  └── Android cleartext traffic restriction

PR 2: CI/CD Pipeline & Action Version Fixes
  ├── Pin official GitHub Action releases (@v4) in web.yml
  ├── Add proxy CI workflow (.github/workflows/proxy.yml)
  └── Add Android CI workflow (.github/workflows/android.yml)

PR 3: Open Source Contributor Enablement
  ├── Add SECURITY.md policy
  ├── Add lightweight local mock proxy server
  ├── Update CONTRIBUTING.md with full command suite
  └── Enhance Issue & PR templates with safety checklists
```

---

## 3. Detailed Tasks & Expected Results

### Phase 1: Security Hardening & Defense-in-Depth (PR 1)

#### Task 1.1: [x] Enforce Strict Request Validation & Size Limits on Proxy
* **Files:** [`proxy/src/index.ts`](../proxy/src/index.ts), [`proxy/src/index.test.ts`](../proxy/src/index.test.ts)
* **Changes:**
  - Validate that `body.question` is a non-empty string after trimming.
  - Set a maximum character limit on `question` (e.g., 500 characters) and `background` (e.g., 1,000 characters).
  - Return HTTP 400 for invalid types and HTTP 413 for oversized payloads.
  - Reject requests with bodies larger than 16 KB early.
* **Expected Result:**
  - Automated tests verify oversized payloads and non-string inputs are rejected immediately with 400/413 before contacting OpenRouter.
  - Zero possibility of oversized token exhaustion attacks draining API balance.

#### Task 1.2: [x] Sanitize & Harden Rate Limit Client Identification
* **Files:** [`proxy/src/index.ts`](../proxy/src/index.ts), [`proxy/src/rateLimit.ts`](../proxy/src/rateLimit.ts)
* **Changes:**
  - Check `cf-connecting-ip`. In production environments, if the client IP header is absent or blank, reject the request with HTTP 400 ("Missing client identifier") rather than pooling all untracked clients into a shared `"unknown"` key.
  - In local development mode (`env.ENVIRONMENT === "dev"` or when `cf-connecting-ip` is set to localhost/missing during `wrangler dev`), allow a dedicated local bypass or isolated key.
* **Expected Result:**
  - Legitimate users sharing common networks or missing headers cannot trigger a global Denial of Service for other users.

#### Task 1.3: [x] Add Comprehensive Web Security Headers
* **Files:** [`web/public/_headers`](../web/public/_headers)
* **Changes:**
  - Add standard defensive HTTP headers to all routes:
    ```http
    /*
      X-Content-Type-Options: nosniff
      X-Frame-Options: DENY
      Referrer-Policy: strict-origin-when-cross-origin
      Permissions-Policy: accelerometer=(self), gyroscope=(self)
      Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.workers.dev; img-src 'self' data:; object-src 'none'; base-uri 'self';
    ```
* **Expected Result:**
  - Cloudflare Pages serves security headers on all responses.
  - Protection against clickjacking, MIME-type sniffing, and unauthorized external connections.

#### Task 1.4: [x] Explicitly Disable Cleartext Traffic on Android
* **Files:** [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml)
* **Changes:**
  - Add `android:usesCleartextTraffic="false"` to `<application>`.
* **Expected Result:**
  - Android 8.0 & 8.1 (API 26–27) devices reject non-TLS HTTP connections, eliminating MITM risks on older supported OS versions.

---

### Phase 2: CI/CD & Action Supply Chain Hardening (PR 2)

#### Task 2.1: [x] Fix GitHub Actions Versions in `web.yml`
* **Files:** [`.github/workflows/web.yml`](../.github/workflows/web.yml)
* **Changes:**
  - Change all `actions/checkout@v7`, `actions/setup-node@v7`, and `actions/upload-artifact@v7` references to pinned official releases (`@v4` or full commit SHAs).
* **Expected Result:**
  - Workflows resolve reliably and securely without referencing invalid or untrusted action tags.

#### Task 2.2: [x] Add Continuous Integration for Proxy
* **Files:** `.github/workflows/proxy.yml`
* **Changes:**
  - Trigger on pull requests and pushes affecting `proxy/**` or `.github/workflows/proxy.yml`.
  - Steps: `npm ci`, `npm test`, `npx tsc --noEmit`.
* **Expected Result:**
  - Breaking changes or typing regressions in Cloudflare Worker code are blocked at PR time.

#### Task 2.3: [x] Add Continuous Integration for Android
* **Files:** `.github/workflows/android.yml`
* **Changes:**
  - Trigger on pull requests and pushes affecting `android/**` or `.github/workflows/android.yml`.
  - Set up JDK 17, inject a mock `hunch8.proxyUrl` in `local.properties`, run `./gradlew assembleDebug` and `./gradlew lintDebug`.
* **Expected Result:**
  - Android build failures and missing dependencies are caught automatically before merging to `main`.

---

### Phase 3: Open Source Contribution & Local Tooling (PR 3)

#### Task 3.1: [x] Create Security Policy (`SECURITY.md`)
* **Files:** `SECURITY.md`
* **Changes:**
  - Define supported branches (`main`).
  - Outline private vulnerability reporting instructions (GitHub Security Advisories or maintainer contact email).
  - Explicitly document boundaries regarding LLM decision score behavior and rate limits.
* **Expected Result:**
  - Security researchers and contributors have a responsible disclosure path rather than opening public issues for sensitive exploits.

#### Task 3.2: [x] Implement Local Mock Proxy for Contributors
* **Files:** `scripts/mock-proxy.mjs` (or `proxy/src/mock-server.ts`), `package.json` / `proxy/package.json`
* **Changes:**
  - Add a lightweight Node HTTP server script returning valid mock 8-ball answers, 429 rate limit, or 422 moderation blocks based on simple request flags.
  - Add command `npm run dev:mock`.
* **Expected Result:**
  - Contributors can clone the repo and immediately run and test the Web PWA or Android app locally without an OpenRouter account or Cloudflare KV setup.

#### Task 3.3: [x] Update Contributor Guidelines (`CONTRIBUTING.md`)
* **Files:** [`CONTRIBUTING.md`](../CONTRIBUTING.md)
* **Changes:**
  - Add missing Web workspace testing steps:
    ```sh
    cd web && npm test && npm run typecheck && npm run e2e
    ```
  - Document local development workflows using the mock proxy.
  - Clarify commit conventions and CI verification steps.
* **Expected Result:**
  - Clear, reproducible developer onboarding with zero guesswork.

#### Task 3.4: [x] Upgrade Issue & Pull Request Templates
* **Files:** [`.github/ISSUE_TEMPLATE/bug_report.md`](../.github/ISSUE_TEMPLATE/bug_report.md), [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md)
* **Changes:**
  - Add OS / Device / Browser / Sensor support fields to bug reports.
  - Add PR checklist:
    - [ ] Unit & typecheck suites pass across workspaces.
    - [ ] No secrets, keys, or credentials committed.
    - [ ] Screen / visual changes verified on device or emulator.
* **Expected Result:**
  - Consistent PR quality and streamlined maintainer review process.

---

## 4. Verification & Acceptance Criteria

| Area | Verification Method | Expected Result |
| :--- | :--- | :--- |
| **Input Validation** | Run `node --test src/index.test.ts` with >500 char string | Worker immediately returns 413 without calling Jev |
| **Rate Limit Fallback** | Send POST request without `cf-connecting-ip` | Rejects or isolates request; does not starve other clients |
| **Security Headers** | Inspect `curl -I https://<deploy-preview>/` | `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` present |
| **Android Cleartext** | Inspect merged manifest in `./gradlew assembleDebug` | `android:usesCleartextTraffic="false"` present in manifest |
| **CI Workflows** | Create sample PR modifying `proxy/` and `android/` | GitHub Actions execute and report green checkmarks |
| **Mock Dev Server** | Run `npm run dev:mock` and test web client | Web client connects and receives deterministic 8-ball answers offline |
