# Recipe Name Voice Guide

**Versioned prompt/style guide for recipe names — v1, FRESCO-449 (2026-09-07).**

Consumed by two places:

1. The founder's offline batch-drafting step (`project-dev-guide.md` § Batch Recipe-Catalog Seeding) when writing new recipe names by hand or with LLM assistance.
2. `scripts/clean-recipe-names.ts`, the deterministic cleanup pass applied once to the existing 1000-recipe catalog.

## The problem this replaces

The original (unversioned, historically Gemini-assisted) drafting pass built names by concatenating a template: `[plato base] + [al estilo X] + [version ligera] + [con SABOR]`. This produced names like:

- `"Tostada con salmón ahumado al estilo mediterráneo con frutos rojos"`
- `"Gambas al ajillo al estilo mediterraneo con guarnicion de temporada"`

Two failure modes, both mechanical (template bugs, not creative failures):

1. **Repetitive filler suffixes** that carry zero information — every dish sounds "al estilo mediterráneo" or comes in a "versión ligera" whether or not that means anything for that dish.
2. **Broken concatenation when a slot was empty** — the template left a dangling connector: `"Curry de y leche de coco picante con jengibre"`, `"Boles de coco y con semillas de girasol..."`.

## Rules for a good recipe name

1. **Max ~6 words.** If the base dish + a real descriptor needs more, cut the descriptor, not the dish.
2. **No filler suffixes.** These add zero photographic or culinary signal — ban them outright (validated in FRESCO-31's `fetch-recipe-photos.ts`, where they were found to dilute stock-photo search relevance for the same reason):
   - `al estilo mediterráneo` / `al estilo del sur`
   - `estilo casero`
   - `versión ligera`
   - `con guarnición de temporada`
   - `con verduras de temporada`
   - `con especias` (as a bare suffix — a *named* spice, e.g. "con canela", is fine)
   - `con hierbas frescas` (as a bare suffix — a *named* herb is fine)
3. **Real flavor/ingredient descriptors stay.** `con miel`, `con canela`, `con frutos rojos`, `con tomate`, etc. — these are specific and vary per recipe, so they carry real signal. The line is: does this phrase name something a camera (or a diner) can actually see/taste, or is it a generic wrapper the generator bolts onto everything?
4. **No dangling connectors.** Never let a name end in a bare `con`, `y`, `de`, `al`, `a la` — that means a template slot was left empty; drop the connector, not just the missing word.
5. **Correct tildes.** `versión`, `mediterráneo`, `guarnición`, etc. — never ship the unaccented generator-bug spelling even inside a phrase you're keeping.

## Sí / No examples

| No (generator bug) | Sí (cleaned) |
| --- | --- |
| `Tostada con queso fresco al estilo mediterraneo con frutos rojos` | `Tostada con queso fresco y frutos rojos` |
| `Gambas al ajillo al estilo mediterraneo con guarnicion de temporada` | `Gambas al ajillo` |
| `Curry de y leche de coco picante con jengibre` | `Curry de leche de coco con jengibre` |
| `Pollo al horno al estilo del sur version ligera` | `Pollo al horno` |
| `Boles de coco y con semillas de girasol con semillas de lino` | `Boles de coco con semillas de girasol y lino` |

## Applying this to new drafts

When drafting a new batch offline, write the dish name directly — base dish + at most one real descriptor. Do not use a combinatorial template. Run new batches through `scripts/clean-recipe-names.ts --dry-run` before insert as a safety net, same as the existing catalog.
