# FRESCO-531 spike — Mercadona public catalog/price API

Throwaway feasibility prototype. **Not wired into the app.** Read-only against
Mercadona's undocumented internal API. Feeds FRESCO-346 (price comparison) and
`ADR-0028` (production-dependency decision, still open — founder sign-off
required before this ships to users).

## Run

```bash
bun scripts/spikes/fresco-531-mercadona-price-api/fetch-mercadona-catalog.ts
```

Writes `out.*.json` (gitignored): category tree sample, a flattened
product/price sample, and the rate-limit probe log.

## What was tested (2026-09-16)

1. `GET /api/categories/` — full category tree, no auth.
2. `GET /api/categories/<id>/` — subcategory detail. **Products and real price
   (`price_instructions`) come back inline** — no need to call
   `/api/products/<id>/` per item. This is a better shape than the ticket's
   original finding: one request per subcategory gets N products with price,
   not one request per product.
3. Rate-limit probe: 10 sequential category fetches, 0ms delay between them.

## Findings

| Check | Result |
|---|---|
| Auth required | No |
| CORS | Not enforced server-to-server (CORS is a browser policy; irrelevant here) |
| 429/403 across 10 sequential requests, 0ms delay | 0 |
| Avg response time | ~110ms |
| Price fields present | `unit_price`, `bulk_price`, `reference_price`, `reference_format` — real, current shelf prices |
| Bot-detection signals | **`_abck` + `bm_sz` cookies on every response — Akamai Bot Manager is active at the edge.** No 403/429 triggered in this test, but the vendor is there and could start challenging on volume, pattern, or fingerprint at any time, without notice |

## Correction to ADR-0027

`ADR-0027` (2026-09-10) says "Mercadona blocks automation" — true only for the
**cart-write** endpoint (`POST /api/carts/`, untouched, still not tested
against production for safety). The **catalog/price (read)** endpoint has no
such block. `ADR-0028` records this distinction; it does not edit `ADR-0027`
(ADRs are append-only — see `.context/ADR/README.md`).

## Carrefour / Dia / Alcampo — not verified this spike

Quick blind probes against likely REST paths (`/api/rest/...`, `/api/v1/...`,
`/api/graphql`, `/api/v6/search`) all 403/404/422'd. That is expected and
proves nothing either way — the Mercadona endpoint above was found by tracing
real browser network traffic (devtools), not by guessing URLs. A real check
needs the same headed-browser trace already used for Bonpreu/Mercadona in the
FRESCO-518 spike. **Flagged as follow-up work, not done in this ticket's
budget.**

## Recommendation

1. **The zero-cost, real-price data source ADR-0027 asked for exists.** It is
   safe to build FRESCO-346's read path on Mercadona catalog/price data.
2. **Cache in Supabase, do not fetch on-demand per user request.** Reasons:
   (a) prices don't change per-request, a daily/twice-daily sync is enough
   freshness for a meal-planning app; (b) on-demand fetch ties every user's
   page load to Mercadona's uptime and to whatever Akamai decides that day;
   (c) a scheduled sync (existing `pg_cron` + `pg_net` pattern, see
   `ADR-0011`) can back off and alert on a 403/429 spike instead of failing a
   live user request.
3. **Before shipping to production**: get the founder's explicit call on the
   ToS/legal-gray-zone risk (`ADR-0028`, Status: Proposed). This spike proves
   technical feasibility; it does not settle whether Fresco should depend on
   an unofficial, unauthenticated internal API for a user-facing feature —
   that is a business/reputational decision, not a technical one.
4. **Ingredient -> product mapping layer is still the prerequisite** (same
   conclusion as the FRESCO-345 spike, tracked as FRESCO-488): matching a
   Fresco recipe ingredient name to a Mercadona product ID is a separate,
   real piece of work this spike does not touch.

## Related

- `ADR-0027` — supermarket integration scope decision (this spike corrects
  its "Mercadona blocks automation" line for reads only)
- `ADR-0028` — read-vs-write distinction + open founder decision on
  production use
- FRESCO-346 (price comparator) — the consumer of this data source
- FRESCO-488 (ingredient -> product mapping layer) — still the prerequisite
- FRESCO-518/519 (cart-write spike, stays closed, untouched by this finding)
