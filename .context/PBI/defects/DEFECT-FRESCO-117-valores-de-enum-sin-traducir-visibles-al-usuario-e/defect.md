# DEFECT: Valores de enum sin traducir visibles al usuario (ej. "muy_bajo", "muy_facil")

**Jira Key:** [FRESCO-117](https://basiliomontescastano.atlassian.net/browse/FRESCO-117)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/recipe/recipe-card.tsx` (campo `coste*estimado`) y `components/recipes/recipe-detail.tsx` (`dificultad` y `coste*estimado`).
- ***Pasos para reproducir***: ver cualquier receta cuyo `dificultad` sea `muy*facil` o `coste*estimado` sea `muy*bajo` (ej. "Batido verde estilo casero con canela" → `20 min ·muy*bajo`; "Tostada integral con tomates cherry y queso feta" en detalle → `11 min · muy_facil · bajo`).
- ***Esperado***: un texto humanizado, igual que ya se hace para las dietas vía `DIETA*LABELS` (ej. `sin*gluten` → "sin gluten").
- ***Observado***: se muestra el valor crudo del tipo `CosteEstimado`/`DificultadReceta` (`api/schemas/recipe.types.ts`: `'muy*bajo' | 'bajo' | 'medio' | 'alto'` y `'muy*facil' | 'facil' | 'media' | 'avanzada'`) tal cual, con guion bajo visible para el usuario final cuando el valor tiene doble palabra.
- ***Evidencia***: screenshot mobile de `/recipes` con "20 min ·muy*bajo" y "60 min ·muy*bajo" visibles; snapshot de accesibilidad de detalle con "11 min · muy_facil · bajo".

## Por qué importa

Expone detalles de implementación (snake*case) directamente al usuario final en una app 100% en español, lo cual desentona con el resto de la UI que sí humaniza sus etiquetas (ej. dietas vía `DIETA*LABELS`).

## Alcance

Crear un mapa de labels equivalente a `DIETA_LABELS` para `CosteEstimado` y `DificultadReceta`, y usarlo en `recipe-card.tsx` y `recipe-detail.tsx`.

## Cómo reproducir

1. Ir a `/recipes`.
2. Ver cualquier receta con dificultad "muy*facil" o coste*estimado "muy_bajo" (ej. "Batido verde estilo casero con canela").
3. Abrir el detalle de una receta con esos valores (ej. "Tostada integral con tomates cherry y queso feta") y observar el mismo problema en dificultad y coste_estimado.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
