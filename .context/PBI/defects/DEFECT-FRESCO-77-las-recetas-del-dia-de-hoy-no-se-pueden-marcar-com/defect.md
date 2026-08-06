# DEFECT: Las recetas del día de hoy, no se pueden marcar como favoritos. El botón del corazón no hace nada

**Jira Key:** [FRESCO-77](https://basiliomontescastano.atlassian.net/browse/FRESCO-77)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

El botón de corazón en las tarjetas de "recetas de hoy" no hace nada al pulsarlo.

## Causa raíz confirmada

`RecipeCard` sí tiene el botón de favorito completamente cableado (`isFavorite` / `onToggleFavorite` props + `onClick` con `preventDefault`/`stopPropagation`) — pero ***ningún call site del componente en toda la app pasa esas props***. No es exclusivo de "recetas de hoy": el mismo problema existe en la biblioteca de recetas y en "Últimas recetas añadidas".

- `components/recipe/recipe-card.tsx:28-33, 75-90` (botón, sin props recibidas)
- `app/(app)/menu/page.tsx:169` — recetas de hoy
- `components/menu/latest-recipes-section.tsx:31` — últimas recetas
- `components/recipes/recipe-library.tsx:214` — biblioteca

## Causa raíz más profunda

No existe capa de persistencia de favoritos en absoluto: sin tabla `favorites`, sin RPC/API de toggle, sin estado en ningún lado del código. Los únicos campos "favorit*" en el schema (`ingredientes*favoritos`, `cocinas*favoritas`) son preferencias de onboarding, no relación de favoritear recetas.

## Relacionado

El botón de corazón "Favoritos" en la cabecera de `/menu` (`aria-label="Favoritos"`, línea 114-116) tampoco tiene `onClick` — mismo síntoma, ver FRESCO-71.

## Alcance real

Más grande que un fix de UI puntual. Requiere: tabla + RLS de favoritos, API/RPC de toggle, wiring de props en los 3 call sites de `RecipeCard`, y la pantalla de FRESCO-71 para listarlos.

***Recomendación***: trabajar FRESCO-77 y FRESCO-71 en secuencia — FRESCO-71 depende del backend que este ticket necesita crear.

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
