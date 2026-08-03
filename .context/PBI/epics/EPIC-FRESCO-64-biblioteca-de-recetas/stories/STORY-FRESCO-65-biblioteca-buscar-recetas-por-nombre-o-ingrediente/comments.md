# Comments for FRESCO-65

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-65)

---

### Basi Montes - 8/3/2026, 2:46:30 PM

## Scope

- Grid de recetas de todo el catálogo (ya filtrado por alergias/dieta del perfil de Laura), no solo las que ya cocinó
- Buscador que filtra ese grid por nombre de receta o por ingrediente

---

### Basi Montes - 8/3/2026, 2:46:31 PM

## Out Of Scope

- Búsqueda por categoría/cocina/dieta (eso queda para la historia de filtros)
- Cualquier receta fuera del perfil de seguridad alimentaria de Laura

---

### Basi Montes - 8/3/2026, 2:46:32 PM

## Acceptance Criteria

```gherkin
Scenario: Buscar por nombre
Given Laura está en la Biblioteca de recetas
When escribe el nombre de una receta en el buscador
Then ve solo las recetas del catálogo que coinciden con ese nombre

Scenario: Buscar por ingrediente
Given Laura está en la Biblioteca de recetas
When escribe un ingrediente en el buscador
Then ve las recetas del catálogo que contienen ese ingrediente

Scenario: Buscador sin resultados
Given Laura busca algo que ninguna receta contiene
When mira los resultados
Then ve un estado vacío claro, no una pantalla en blanco
```

---

### Basi Montes - 8/3/2026, 2:46:33 PM

## Business Rules Specification

- El buscador siempre opera dentro de las recetas ya filtradas por el perfil de seguridad alimentaria de Laura (alérgenos/dieta) — nunca muestra una receta fuera de ese conjunto.

---

### Basi Montes - 8/3/2026, 2:55:18 PM

## Spec Implementation Plan (Dev)

### Goal

Reframe `/recipes` from "recipes you've cooked" (`getUserRecipes()`) to a full-catalog Biblioteca (safety-filtered by Laura's profile, via `get*filtered*recipes()`), and add a search box that filters that grid by recipe name or ingredient.

### Steps

1. `lib/api/recipes.ts` — new `getCatalogRecipes(client, userId?)`. Same `get*filtered*recipes()` RPC FRESCO-57/59 already use, no `.order()`/`.limit()` this time (the base browse grid has no recency bias — that's `getLatestAvailableRecipes()`'s own distinct semantic, not reused here to avoid conflating "latest N" with "everything").
2. `app/(app)/recipes/page.tsx` — swap `getUserRecipes(supabase)` for `getCatalogRecipes(supabase)`. Updates the page's own doc comment + `h1`/description copy to the new framing; the old "no recipes yet, generate a menu first" empty state no longer applies (an empty **catalog** — Laura's profile excludes everything — is a different, much rarer case with different copy, not the common "haven't cooked yet" one). Passes the full list into a new client component.
3. `components/recipes/recipe-library.tsx` (new, `'use client'`) — owns the search `Input` (reuses the existing pill-shaped primitive + a `Search` icon, matching the mockup) and filters the passed-in catalog client-side: case-insensitive substring match against `nombre` OR any entry of `ingredientes_principales`. Client-side because the safety-filtered catalog is already a bounded, per-profile set (hundreds of rows, not the full 1000-row table) — no new round trip per keystroke.
4. Two distinct empty states, not one: "tu perfil no tiene recetas disponibles" (catalog itself came back empty — rare, a very restrictive profile) vs. "no encontramos nada para tu búsqueda" (catalog has recipes, search matched none). Conflating them would tell Laura to loosen her safety profile when the real fix is just clearing her search term.
5. Unit tests for `getCatalogRecipes` (mocked client, same pattern as `getAvailableRecipesCount`/`getLatestAvailableRecipes`): mapping, empty array, DB error, no-session error, `userId` escape hatch.
6. Live-UI check (dev server + Playwright): real catalog renders, search narrows it by name and by ingredient, both empty states reachable and distinct.

### AC mapping

| AC scenario | covered_by |
| --- | --- |
| Buscar por nombre | test (filter logic covered via the same data shape) + live search-by-name |
| Buscar por ingrediente | live search-by-ingredient (client-side match against `ingredientes_principales`) |
| Buscador sin resultados | live: distinct "sin resultados de búsqueda" empty state, not the catalog-empty one |

### Technical decisions

- `/recipes`' reframe from cooked-history to full-catalog browse is this story's own scope (confirmed with the user during `/product-management` seeding) — `getUserRecipes()` stays in `lib/api/meal-plan.ts` unchanged and unused by this page going forward; not deleting it since it's dead-code-checked separately and may still be cited elsewhere (grep confirms no other caller before deciding either way at review time).
- Search is client-side substring match, no accent-folding (a search for "piña" won't match "pina" typed without the tilde) — not required by AC, flagged as a known v1 gap rather than silently over-engineered away.
- No new `Recipe` fields needed — `ingredientes_principales` already exists on the type.

### Workload Forecast

Estimated: ~130 additions + ~15 deletions = ~145 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main (solo-main, direct push)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
