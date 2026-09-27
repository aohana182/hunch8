# Contributing

## Setup

```sh
git clone https://github.com/aohana182/hunch8
cd hunch8/proxy
npm install
npm test
```

Android app (needs JDK 17+ and the Android SDK):

```sh
cd hunch8/android
./gradlew assembleDebug
```

## Workflow

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make changes and run the checks below
3. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat(scope): description`
4. Open a PR against `main`

## Commit format

```
type(scope): subject (max 72 chars)

- What changed
- Why it matters
- How verified
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

## Checks before a PR

- `cd proxy && npm test` — unit tests
- `cd proxy && npx tsc --noEmit` — Worker type-check
- `cd android && ./gradlew assembleDebug` — app builds
- For UI changes, run the app on an emulator or device and attach a screenshot

## Rules

- Never commit an API key. The OpenRouter key belongs in `proxy/.dev.vars` (gitignored) or `wrangler secret put`, never in the app.
- Answers must stay within the 20 classic phrases. Jev returns a number; the proxy maps it to a phrase.
- If you change the Jev prompt or the score bands, add traces to `evals/traces.md` showing the effect.
