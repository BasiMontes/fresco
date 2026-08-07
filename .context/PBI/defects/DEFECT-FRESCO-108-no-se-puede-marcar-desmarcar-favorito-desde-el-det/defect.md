# DEFECT: No se puede marcar/desmarcar favorito desde el detalle de receta

**Jira Key:** [FRESCO-108](https://basiliomontescastano.atlassian.net/browse/FRESCO-108)
**Priority:** Medium
**Status:** WIP
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `/recipes/[id]` para recetas de catálogo — `components/recipes/recipe-detail.tsx` (`CatalogRecipeDetail`).
- `RecipeDetailView`/`CatalogRecipeDetail` no renderiza ningún botón de favorito.
- El único workaround es volver a Biblioteca o a Favoritos y buscar la misma tarjeta ahí.
- El comentario "OOS" del componente lista explícitamente edit/delete/rate/menu-add/share como fuera de alcance, pero ***no menciona favorito*** — no parece ser una exclusión intencional documentada, sino un gap.
- ***Evidencia***: Snapshot de accesibilidad de `/recipes/f6ae0b9d-...` sin ningún `button` con aria-label "Guardar en favoritos" / "Quitar de favoritos".

## Por qué importa

El corazón de favorito es un control funcional y central en Biblioteca y Favoritos (`RecipeCard`/`FavoriteRecipeCard`). El detalle de receta es precisamente la vista donde el usuario más probablemente decide guardar una receta como favorita, y ahí no tiene forma de hacerlo sin salir de la pantalla.

## Alcance

Agregar el mismo control de favorito (`Heart` + `onToggleFavorite`, patrón ya usado en `RecipeCard`) a `components/recipes/recipe-detail.tsx` (`CatalogRecipeDetail`) — solo para recetas de catálogo, no recetas propias (que no son favoriteables por diseño, ya confirmado en el reporte fuente: `favorites.recipe*id` FK solo apunta a `public.recipes`, no a `recetas*propias`).

## Cómo reproducir

1. Entrar a cualquier receta de catálogo por su URL de detalle (ej. `/recipes/c06a7050-bf5d-4b70-b320-11fa381b247e`).
2. Buscar un botón/icono de favorito en la pantalla.
3. Observar que no existe ningún control para marcar/desmarcar favorito desde esta vista.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
