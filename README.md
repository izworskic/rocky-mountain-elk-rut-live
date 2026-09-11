# Rocky Mountain Elk Rut Live

Decision-support tool for elk-rut visitors to Rocky Mountain National Park.

## What it answers

- Should I go at the next dawn or dusk window?
- How strong is the current seasonal rut phase?
- Will wind, precipitation or temperature make viewing harder?
- Which east- or west-side viewing area is favored?
- Does the recommended arrival time fall inside a 2026 timed-entry window?
- What rut meadow closures and wildlife-distance rules apply?

The score is intentionally **not** presented as a probability of seeing elk. Wildlife movement is variable. The engine ranks viewing windows using a seasonal rut baseline plus live viewing conditions.

## Data model

- NPS rut-season guidance: September and October, with a strong mid-September to mid-October baseline.
- Solar geometry: dawn and dusk candidate windows calculated in `America/Denver`.
- National Weather Service: hourly temperature, precipitation probability, wind and forecast conditions for east- and west-side RMNP zones.
- 2026 access rules: Bear Lake Road Timed Entry+ and standard park Timed Entry are modeled separately.
- NPS safety/closure rules: 75-foot elk distance and Sep. 1-Oct. 31 evening/morning meadow closures.

## Scoring

- 72% seasonal rut phase
- 28% live viewing conditions

Weather affects visitor viewing quality; it is not claimed to cause the rut. Missing NWS data is disclosed and never fabricated.

## Routes

- Product: `/national-tools/elk-rut/`
- API: `/api/live`
- Canonical future proxy API: `/national-tools/elk-rut/_api/live`

The page tries the canonical proxy API first and falls back to `/api/live`, allowing both chrisizworski.com proxy deployment and direct Vercel preview testing.

## Local verification

```bash
npm test
npm run verify:static
npm run verify
```

## Intended production composition

This repository owns the elk product. `national-outdoor-tools-hub` should contain only discovery/routing.

Once this repo is deployed to Vercel, add these hub rewrites (replace the hostname with the actual deployment):

```json
{ "source": "/national-tools/elk-rut", "destination": "https://rocky-mountain-elk-rut-live.vercel.app/national-tools/elk-rut/" },
{ "source": "/national-tools/elk-rut/", "destination": "https://rocky-mountain-elk-rut-live.vercel.app/national-tools/elk-rut/" },
{ "source": "/national-tools/elk-rut/_api/live", "destination": "https://rocky-mountain-elk-rut-live.vercel.app/api/live" }
```

Then add one crawlable National Tools card linking to `/national-tools/elk-rut/` and include that canonical URL in the directory ItemList.

## Analytics

Uses the shared Chris Izworski GA4 measurement ID `G-Y5D2V2W7HN` and AdSense publisher `ca-pub-8222782620788075`.
