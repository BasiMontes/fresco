# Comments for FRESCO-67

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-67)

---

### Basi Montes - 8/3/2026, 2:46:38 PM

## Scope

- Filtro por tipo de cocina (las mismas etiquetas ya visibles en cada card: española, italiana, mediterránea, etc.)
- Filtro por restricción de dieta (vegetariano, vegano, sin gluten, etc.)
- Filtro por un alérgeno puntual que Laura quiera evitar en esa búsqueda, aunque no lo tenga declarado en su perfil

---

### Basi Montes - 8/3/2026, 2:46:39 PM

## Out Of Scope

- Guardar combinaciones de filtros como favoritas
- Cambiar el perfil permanente de Laura desde estos filtros

---

### Basi Montes - 8/3/2026, 2:46:41 PM

## Acceptance Criteria

```gherkin
Scenario: Filtrar por cocina
Given Laura está en la Biblioteca
When selecciona un filtro de cocina, por ejemplo "Italiana"
Then ve solo recetas de esa cocina

Scenario: Filtrar por dieta
Given Laura está en la Biblioteca
When selecciona un filtro de dieta, por ejemplo "Vegano"
Then ve solo recetas que cumplen esa restricción

Scenario: Filtrar por un alérgeno puntual
Given Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil
When activa ese filtro de alérgeno en la Biblioteca
Then no ve ninguna receta que lo contenga, sin que cambie su perfil permanente
```

---

### Basi Montes - 8/3/2026, 2:46:42 PM

## Business Rules Specification

- Estos filtros son de la sesión de exploración de Laura — nunca modifican su perfil permanente ni sus exclusiones ya declaradas en onboarding.
- Estos filtros solo pueden restringir más el conjunto de recetas, nunca mostrar una receta ya excluida por el perfil permanente.

---

### Basi Montes - 8/3/2026, 3:23:07 PM

## Spec Implementation Plan (Dev)

### Goal

Add cuisine / diet / one-off-allergen filters to the Biblioteca grid (FRESCO-65/66), combinable with the existing search and meal-type tab.

### Steps

1. `components/recipe/recipe-card.tsx` — export the existing private `DIETA_LABELS` map (already has all 10 `RecipeDieta` flags with display labels) instead of duplicating a second copy in the new filter UI.
2. `components/recipes/recipe-library.tsx` — 3 new native `<select>` controls (no dropdown primitive exists in this design system yet; a native `<select>`, styled to match `Input`'s pill shape, is the simplest correct choice for two 7–10-option single-pick lists — `SegmentedControl` renders every option as a visible pill and would be too wide/cluttered at that count, unlike the 4-option meal-type tab):
3. Filter combines with the existing predicates: a recipe passes when it matches search AND meal tab AND (cocina filter is "Todas" OR `clasificacion?.cocina` matches) AND (dieta filter is "Cualquiera" OR that `dieta` flag is true) AND (allergen filter is "Ninguno" OR that allergen is NOT in `alergenos`).
4. No new data fetch — `getCatalogRecipes()` already returns `clasificacion`, `dieta`, and `alergenos` for every recipe.
5. Live-UI check (dev server + Playwright): each filter narrows correctly, resets to "show all" at its default option, and composes with search/tab already in place.

### AC mapping

| AC scenario | covered_by |
| --- | --- |
| Filtrar por cocina | live-ui |
| Filtrar por dieta | live-ui |
| Filtrar por un alérgeno puntual | live-ui |

### Technical decisions

- Native `<select>` over a custom dropdown component — no such primitive exists in this design system, and building one for a single story would be a bigger diff than the filtering logic itself. Styled minimally (pill shape, matching `Input`) rather than left unstyled.
- The allergen filter is a temporary, session-only narrowing (per the story's own Business Rules) — it never writes to `user*profiles`, and never widens past what the permanent profile already excludes (a recipe already excluded by the profile's `get*filtered_recipes()` pass never re-enters via this filter, since this filter only runs client-side on the already-safety-filtered catalog).
- Reused `ALERGENO_OPTIONS` (already the DB-verified, curated vocabulary) instead of inventing a second list that could drift from what `recipes.alergenos` actually contains.

### Workload Forecast

Estimated: ~90 additions + ~5 deletions = ~95 total lines
400-line budget risk: Low
Chain strategy: stacked-to-main (solo-main, direct push)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
