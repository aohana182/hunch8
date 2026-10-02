# Security Policy

## Supported Versions

Only the latest commit on `main` and active production deployments receive security updates.

| Version / Target | Supported          |
| ---------------- | ------------------ |
| `main` branch    | :white_check_mark: |
| Web PWA (`hunch8.pages.dev`) | :white_check_mark: |
| Android App (latest source build) | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Hunch8 seriously. If you discover a vulnerability, please report it privately:

1. **GitHub Private Vulnerability Reporting**: Open a draft advisory under the **Security** tab of this repository.
2. **Direct Contact**: If private reporting is unavailable, contact the project maintainer via the email listed on their GitHub profile.

Please **do not** open public GitHub issues for security vulnerabilities, API key leaks, or exploit demonstrations.

### When reporting, please include:
- A clear description of the vulnerability.
- Steps to reproduce or a minimal proof of concept.
- Potential impact and affected components (`proxy`, `web`, `android`, or CI/CD).
- Any proposed remediation or patch.

We will acknowledge receipt within 48 hours and work with you on verification and coordinated disclosure.

## Security Architecture & Boundaries

- **API Keys**: OpenRouter API keys belong solely in Cloudflare Worker secrets (`wrangler secret put OPENROUTER_API_KEY`). They must never be placed in source files, client bundles, or APK assets. CI includes automated checks to prevent key leakage into web distribution assets.
- **Input Validation & Quotas**: The proxy enforces input length restrictions (max 500 characters for questions) and a rate limit of 50 asks per IP per day to guard against compute and API credit exhaustion.
- **Decision Model Safety**: Hunch8 utilizes TypeSafe's Jev model through OpenRouter's Decisions API. Outputs are constrained to discrete numerical scores mapped strictly to the 20 classic Magic 8-Ball phrases. Moderation is handled via a dedicated `noul` decision returning HTTP 422 for flagged inquiries.
- **Transport Security**: All production clients communicate strictly over HTTPS with cleartext traffic disabled.
