## What

[What this PR changes — be specific about files and behavior]

## Why

[The problem it solves or requirement it satisfies]

## Verification Checklist

Please verify the components affected by your changes:

- [ ] **Proxy:** `cd proxy && npm test && npx tsc --noEmit`
- [ ] **Web:** `cd web && npm test && npm run typecheck && npm run build`
- [ ] **Android:** `cd android && ./gradlew assembleDebug`
- [ ] **Playwright E2E (if web UI touched):** `cd web && npm run e2e`
- [ ] **Manual verification:** [Describe what you tested and how]

## Security & Quality

- [ ] No secrets, private tokens, or API keys are committed or referenced.
- [ ] No cleartext / non-TLS endpoints added to client configurations.
- [ ] Answers remain constrained strictly to the 20 classic 8-ball phrases.

## Screenshots / Evidence

[Attach screenshot or terminal output for UI or workflow changes]
