# DEFECT: Número de recetas

**Jira Key:** [FRESCO-74](https://basiliomontescastano.atlassian.net/browse/FRESCO-74)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Confirmado con el reporter: cubre dos partes

### Parte 1 — auditar el contador en /menu

`components/menu/available-recipes-card.tsx:13-27` muestra "X recetas disponibles para ti", alimentado por `getAvailableRecipesCount()` (`lib/api/recipes.ts:51-75`), que llama al RPC `get*filtered*recipes()` con `count: 'exact'`.

No se encontró nada hardcodeado ni obviamente stale en el código — si el número se ve mal en vivo, sería un bug de datos/runtime (filtro de perfil, RLS), no del componente en sí. ***Necesita reproducirse en vivo*** con un perfil real para diagnosticar la causa.

***Pendiente del reporter***: ¿con qué perfil/filtro se vio el número mal, y cuál era el valor esperado?

### Parte 2 — agregar contador a /recipes

La biblioteca de recetas (`app/(app)/recipes/page.tsx`, `components/recipes/recipe-library.tsx`) no muestra ningún "X recetas encontradas" — confirmado ausente en el código. Esto es una tarea de agregar (no un bug).

## Alcance

Parte 1 depende de reproducción en vivo con el user antes de poder diagnosticar. Parte 2 es implementable directo.

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
