# DEFECT: Falta espacio en el meta de la tarjeta de receta ("30 min ·alto")

**Jira Key:** [FRESCO-116](https://basiliomontescastano.atlassian.net/browse/FRESCO-116)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/recipe/recipe-card.tsx` líneas ~116-121 (afecta toda tarjeta de receta de catálogo, tanto en `/recipes` como en `/favorites`).
- ***Pasos para reproducir***: ver cualquier tarjeta de receta en la grilla de Biblioteca o Favoritos.
- ***Esperado***: `"30 min · alto"` (espacio antes y después del punto medio).
- ***Observado***: se renderiza `"30 min ·alto"` — sin espacio entre el `·` y el valor de `coste*estimado`, porque el JSX tiene `min ·` seguido de `{recipe.meta?.coste*estimado ?? '—'}` en la siguiente línea sin un `{' '}` explícito (a diferencia de `recipe-detail.tsx`, que sí lo tiene correctamente en las tres posiciones). Confirmado en el árbol de accesibilidad y visualmente en screenshots a 1280px y 375px.

## Por qué importa

Defecto tipográfico visible en todas las tarjetas de receta del catálogo (Biblioteca y Favoritos); afecta la percepción de pulido de la UI aunque no bloquea ninguna funcionalidad.

## Alcance

Agregar el `{' '}` explícito faltante entre "min ·" y el valor de `coste_estimado` en `recipe-card.tsx`, igual que ya hace correctamente `recipe-detail.tsx` en las tres posiciones.

## Cómo reproducir

1. Ir a `/recipes` o `/favorites`.
2. Ver cualquier tarjeta de receta de catálogo — el meta se muestra como "30 min ·alto" en vez de "30 min · alto".

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
