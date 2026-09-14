# FRESCO-488 spike — matching against the Mercadona catalog dataset

Throwaway feasibility prototype. **Not wired into the app.** Follow-up to the
FRESCO-345 deep-link spike (`scripts/spikes/fresco-345-grocery-deeplink/`):
that one sent users to the retailer's own search box and found it too noisy
to build on. This one matches against a downloaded, structured catalog
instead — Fresco controls the matching, not the retailer's search engine.

## Data source

[`datania/mercadona-catalog`](https://huggingface.co/datasets/datania/mercadona-catalog)
(MIT, community-maintained, weekly export of Mercadona's own unofficial JSON
API). Downloaded and cached locally on first run (`cache/`, gitignored).

## Run

```bash
bun scripts/spikes/fresco-488-mercadona-catalog-match/prototype.ts
```

Reads the same fixture as the FRESCO-345 spike
(`../fresco-345-grocery-deeplink/fixture-shopping-list.json` — Laura's real
weekly plan, 6 pasillos / 23 items) for a direct before/after comparison.
Writes `out.scorecard.md` / `out.scorecard.json` (gitignored).

## Result (2026-09-13)

**22/23 items matched (96%)**, vs. the Dia deep-link's 78% clean / 9% noisy /
13% broken on the same list. The one miss (`levadura nutricional`) is a real
gap — Mercadona genuinely does not stock it — not a broken search.

Estimated cost for the full list: **33.47 EUR** (catalog-matched) vs. **44.49
EUR** (Fresco's original generic per-item average). Not a claim that Fresco's
estimate was wrong — different baskets, different pack sizes — but proof the
catalog carries a real, usable price per item.

## What made this more reliable than the deep-link

- Matching happens against data Fresco holds locally, not a retailer's live
  search UI — no dependency on how good (or bad) their fuzzy match is.
- Every product carries `unit_size` / `reference_price` / `reference_format`
  (price per kg or L) — the exact fields the deep-link spike found missing.
  Weight/volume items convert cleanly; count-based items (`unidades`,
  `dientes`, `rebanadas`) still fall back to "price of one package" since
  there is no unit to convert.

## What this does NOT fix (found live, worth carrying into FRESCO-488)

- **Naive substring matching produces real false positives.** First attempt:
  `pan` matched `Compango` (a stew mix — "pan" appears mid-word), `leche`
  matched a bread roll (`6 Panes de leche 3%`) before a "shortest name wins"
  tie-break was replaced with "term is the product's first word wins".
  Residual noise still happens (`nueces` → a pecan pastry, not plain nuts) —
  a real ingredient-canonicalization layer needs more than string matching
  (category filtering, at minimum).
- **Regional synonyms aren't in the raw ingredient name.** `boniato` only
  matched after a manual `boniato → batata` synonym was added — Mercadona's
  catalog uses "Batata", never "Boniato". A real synonym table is
  prerequisite work, not a one-off patch.
- **Lossy recipe names** (the fixture stores `salmón`, the recipe meant
  `salmón ahumado`) still pick a plausible-but-not-exact product
  (`Salmón a rodajas` fresh fillet, not the smoked kind the recipe needs).
- Count-based units (`dientes`, `rebanadas`, `unidades`) have no reliable
  price conversion — approximated as "one package", which over- or
  under-estimates depending on how much of the package the recipe actually
  needs.

## Related

- FRESCO-345 / FRESCO-346 / FRESCO-488 (Jira) — full research trail and the
  "start with Mercadona only" decision live in FRESCO-345's comments.
