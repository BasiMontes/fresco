# Comments for FRESCO-66

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-66)

---

### Basi Montes - 8/3/2026, 2:46:35 PM

## Scope

- Pestañas Todo/Desayuno/Comida/Cena sobre el grid de la Biblioteca
- Combinable con el buscador (buscar dentro de la pestaña activa)

---

### Basi Montes - 8/3/2026, 2:46:36 PM

## Out Of Scope

- Pestañas adicionales más allá de Todo/Desayuno/Comida/Cena (por ejemplo, "snack")

---

### Basi Montes - 8/3/2026, 2:46:37 PM

## Acceptance Criteria

```gherkin
Scenario: Filtrar por tipo de comida
Given Laura está en la Biblioteca
When toca la pestaña "Desayuno"
Then ve solo recetas de desayuno del catálogo

Scenario: Volver a ver todo
Given Laura tiene una pestaña de tipo de comida activa
When toca "Todo"
Then vuelve a ver el catálogo completo

Scenario: Buscador y pestaña combinados
Given Laura tiene la pestaña "Comida" activa
When escribe algo en el buscador
Then los resultados respetan ambos filtros a la vez
```

---

### Basi Montes - 8/3/2026, 3:11:18 PM

## Spec Implementation Plan (Dev)

### Goal

Add Todo/Desayuno/Comida/Cena tabs to the Biblioteca grid (FRESCO-65), combinable with the existing search box.

### Steps

1. `components/recipes/recipe-library.tsx` — extend the existing client component (it already owns `query` state from FRESCO-65) with a `tab` state (`'todo' | 'desayuno' | 'comida' | 'cena'`, default `'todo'`). Reuse the existing `SegmentedControl` primitive (`components/ui/segmented-control.tsx`) — already the exact "radio-style pill group" shape the mockup's tabs need; no new tab component to build.
2. Filter combines both: a recipe passes when it matches the search query AND (tab is "todo" OR `recipe.clasificacion?.tipo_plato === tab`). A recipe with `clasificacion: null` (some seed rows are only partially populated, per `RecipeCard`'s own doc comment) never matches a specific tab but still shows under "Todo" — same optional-chaining fallback pattern already used elsewhere for `clasificacion`.
3. No new data fetch — `getCatalogRecipes()` (FRESCO-65) already returns every recipe's `clasificacion`; this story only adds client-side filtering on a field already present.
4. Live-UI check (dev server + Playwright): each tab narrows correctly, "Todo" returns to the full set, tab + search combined narrows to the intersection.

### AC mapping

| AC scenario | covered_by |
| --- | --- |
| Filtrar por tipo de comida | live-ui: each tab |
| Volver a ver todo | live-ui: "Todo" tab |
| Buscador y pestaña combinados | live-ui: both active together |

### Technical decisions

- No new unit test file — the added filter logic is a pure predicate composed inline in the same component FRESCO-65 already left without a dedicated render test (no React-render-test harness exists in this repo, established precedent this session). The one new pure branch (tab match) is simple enough to cover via live-UI + code review.
- Reusing `SegmentedControl` instead of a bespoke tab bar — same component DESIGN.md already documents for "radio-style pill group" selections, avoids inventing a second implementation of the same UI pattern.

### Workload Forecast

Estimated: ~45 additions + ~5 deletions = ~50 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main (solo-main, direct push)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
