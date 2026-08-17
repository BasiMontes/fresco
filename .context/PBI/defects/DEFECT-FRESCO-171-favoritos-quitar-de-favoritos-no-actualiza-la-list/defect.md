# DEFECT: Favoritos: quitar de favoritos no actualiza la lista en vivo en /favorites

**Jira Key:** [FRESCO-171](https://basiliomontescastano.atlassian.net/browse/FRESCO-171)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/(app)/favorites/page.tsx` (server component, lee `getFavoriteRecipes()` una vez) + `components/recipe/favorite-recipe-card.tsx`/`favorite-toggle-button.tsx` (toggle 100% client-side, sin `router.refresh()` ni callback al padre).
- Hallazgo del QA sweep (agente Recetas+Favoritos, MAJOR): quitar de favoritos desde `/favorites` borra el dato correctamente (confirmado tras recarga) pero la tarjeta se queda visible en el grid, solo con el botón cambiando a "Guardar en favoritos" — lee como roto hasta refrescar la página manualmente.

## Cambio propuesto

- Extraer el grid de `/favorites` a un pequeño componente cliente que mantenga la lista de recetas en estado local (mismo patrón que `misRecetas` en `recipe-library.tsx`) y remueva el item de la lista cuando se desfavorita desde esta página específica. Agregar un callback opcional (`onToggleFavorite`) a `FavoriteRecipeCard` para que el padre se entere del cambio.

## Alcance

- `app/(app)/favorites/page.tsx` + nuevo componente cliente para el grid. `FavoriteRecipeCard` gana un prop opcional, no rompe otros usos (recipe-library.tsx, /menu) que no lo pasan.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
