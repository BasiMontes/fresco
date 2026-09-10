# FRESCO-345 spike — grocery integration (deep-link + export)

Throwaway feasibility prototype. **Not wired into the app.** The story is
BLOCKED by `mvp-scope.md` until MRR > 5.000 EUR **and** 30-day retention > 50%.
This exists so the build/no-build decision is already made when the block lifts.

## Run

```bash
bun scripts/spikes/fresco-345-grocery-deeplink/prototype.ts
```

Reads `fixture-shopping-list.json` (a real prod list snapshot — Laura's weekly
plan, 6 pasillos / 23 items). Writes `out.*` (gitignored): the deep links and
the three export formats.

## What was tested

1. Per-item deep link to Carrefour and Dia (search page preloaded with the term).
2. List export: plain text, CSV, Markdown checklist.
3. Feasibility scorecard against the real list.

## Deep-link findings (2026-09-10)

| Retailer | Search URL | State |
|---|---|---|
| Dia | `https://www.dia.es/search?q=<term>` | works, anonymous (price/stock need a postal code) |
| Carrefour | `?q=` ignored (loads homepage); `search-page?q=` returns HTTP 403 to non-browser clients | unconfirmed, not a stable public contract |

Dia search quality, real terms from the list:

| Term | Result | Verdict |
|---|---|---|
| `tomate` | 110 products + refinement chips | good |
| `aceite de oliva virgen extra` | 21, all correct | good |
| `salmón` | 33 real, incl. smoked, **but mixed with pet food** | noisy |
| `tofu` | 11 results, **all "toffee"** (sweets, crisps) | broken |
| `levadura nutricional` | **"Sin resultados"** | broken |

Projection over 23 items: ~78% clean term with a usable result, ~9% relevant
but noisy, ~13% broken (short term the retailer's fuzzy match ruins, or niche
product they do not stock).

## Structural limits (not fixable in our code)

- **No cart-preload deep link** for either retailer. "Deep link" = 23 manual
  searches + 23 add-to-cart per retailer, every week (~46 interactions).
- **Search quality is the retailer's.** We send the user into an experience we
  do not control and that is sometimes bad (see `tofu`).
- **Unit-reconciliation gap: 19/23 items (83%)** are in g/ml/dientes/rebanadas.
  A deep link cannot carry "you need 500 ml" — the shopper eyeballs pack size.
- **Lossy names:** the recipe asked for "salmón ahumado", the list stores
  "salmón". 3 items like this.
- Carrefour blocks automation. Hardest, least friendly integration.

## Recommendation

1. **Do not build the deep link.** Same friction as export (manual item-by-item
   search), worse reliability, dependent on the retailer not changing its site.
2. **If anything ships when unblocked: structured export.** Small, safe, useful
   now. "Copy list" + "open <retailer> app" buttons.
3. **Real one-click-to-cart needs a recipe-commerce provider** (Northfork /
   Whisk) with a live Spanish retailer, or a B2B deal (Glovo / Uber). Confirm
   coverage and price on a sales call first. Blocked by the market, not budget.
4. **Prerequisite for every path: the ingredient -> product + unit
   reconciliation layer.** 83% of items carry a non-retail unit. That layer is
   the real work and it is reusable for the price comparator (FRESCO-346).

## Related

- FRESCO-346 (price comparator) — same catalog-access wall.
- FRESCO-344 (calendar-synced shopping reminder) — the prior step, doable with
  no integration.
