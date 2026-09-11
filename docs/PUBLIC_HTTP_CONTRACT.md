# Rocky Mountain Elk Rut Live public HTTP contract

Version: v1

The authoritative engine remains in this repository. Public network routers may consume these artifacts over HTTP without copying the implementation.

## Page artifact

`public/national-tools/elk-rut/index.html`

The page's canonical URL remains:
`https://chrisizworski.com/national-tools/elk-rut/`

For a release, route the canonical URL to an immutable commit-pinned copy of this HTML artifact.

## Live data

`public/v1/live.json`

The snapshot is regenerated every 15 minutes by GitHub Actions from `api/live-v2.js`.

Contract guarantees:
- `schemaVersion` is `1`.
- `mode` is `live` or `degraded`.
- `primary` is the next chronological dawn/dusk decision window.
- `windows` contains up to six chronological upcoming windows.
- missing NWS inputs are disclosed rather than fabricated.
- scores are decision rankings, never probabilities of seeing elk.

Consumers should route `/national-tools/elk-rut/_api/live` to the latest `main` copy of `public/v1/live.json`.
