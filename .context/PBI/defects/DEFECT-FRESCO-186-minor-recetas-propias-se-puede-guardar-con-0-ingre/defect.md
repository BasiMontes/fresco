# DEFECT: [MINOR] Recetas propias: se puede guardar con 0 ingredientes y 0 pasos, el detalle renderiza secciones vacías sin placeholder

**Jira Key:** [FRESCO-186](https://basiliomontescastano.atlassian.net/browse/FRESCO-186)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: `components/recipes/create-recipe-form.tsx` (única validación: `isValid = trimmedNombre.length > 0`) y `components/recipes/recipe-detail.tsx` (`PersonalRecipeDetail`)

## Observado

Al crear una receta solo con nombre, el detalle muestra los encabezados "Ingredientes" y "Preparación" seguidos de listas visualmente vacías, sin ningún placeholder tipo "sin ingredientes añadidos" — se lee como página rota/incompleta en vez de receta intencionalmente vacía.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/13/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
