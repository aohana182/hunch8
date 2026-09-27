# Privacy Policy — Hunch8

_Effective: September 27, 2026_

Hunch8 is a hobby app. It is built to collect as little as possible. This page explains exactly what happens to your data.

## The short version

- No accounts, no sign-up, no analytics, no ads, no tracking, no crash reporting.
- Everything stays on your phone **except the question you tap the ball to ask**. That text is sent over the internet to get an answer.
- The developer does not read, log or store your questions.
- Your IP address is kept for up to about 25 hours, only to enforce the limit of 50 questions per day.

## What stays on your phone

The question you type and the answer you get are kept only in the app's memory. Android may keep them briefly so the screen survives a rotation or the app being paused. This data never leaves your device except as described below. It is deleted when you clear the text field, close the app from recent apps, or uninstall it.

## What leaves your phone, and where it goes

When you tap the ball, and only then:

1. **The Hunch8 proxy.** The text you typed is sent over HTTPS to a small server run by the developer on Cloudflare Workers. It forwards the text and returns the answer. It does **not** save your question.
2. **OpenRouter.** The proxy sends your text to [OpenRouter](https://openrouter.ai), which routes it to the model provider.
3. **TypeSafe.** The Jev model, made by TypeSafe, reads the text and returns a score.

OpenRouter and TypeSafe are third parties. Their own privacy policies govern what they do with the text they receive, and the developer does not control how long they keep it. Please read [OpenRouter's privacy policy](https://openrouter.ai/privacy) if this matters to you.

**Don't type anything you wouldn't want a third party to see**: no names, phone numbers, addresses, health details, passwords or other personal information.

## What the proxy keeps

- **Your IP address, for rate limiting.** The proxy stores a counter keyed by your IP address and the current date so it can stop anyone from asking more than 50 questions a day. The entry deletes itself after about 25 hours. It is not used for anything else and is not combined with anything else.
- **Error messages.** If a request fails, the proxy may record the error from the upstream service. It does not record your question.

Like any website, Cloudflare processes the network traffic (including your IP address) to deliver requests, under [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

## What Hunch8 does not do

- Sell, rent or share your data with anyone beyond the services named above
- Build a profile of you
- Use cookies, advertising IDs or device fingerprinting
- Ask for your location, contacts, camera, microphone or any other permission besides internet access

## Children

Hunch8 is not directed at children under 13 and does not knowingly collect information from them.

## Changes

If this policy changes, the updated version will be published in this repository with a new effective date.

## Contact

Questions about privacy: open an issue at <https://github.com/aohana182/hunch8/issues>.
