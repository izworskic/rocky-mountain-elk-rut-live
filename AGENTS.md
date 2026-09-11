# Agent boundary

This repository is the authoritative implementation for Rocky Mountain Elk Rut Live.

Preserve the public canonical URL:
`https://chrisizworski.com/national-tools/elk-rut/`

Do not move product-specific scoring logic into `national-outdoor-tools-hub`; that repository should only own discovery and routing.

Before release:
1. Run `npm run verify`.
2. Confirm the API returns JSON and the page works in degraded mode if NWS is unavailable.
3. Confirm GA4 `G-Y5D2V2W7HN` remains in emitted HTML.
4. Confirm canonical URL, title/description limits, NPS safety wording and 2026 access dates remain correct.
5. Never describe the score as a probability of seeing elk.
