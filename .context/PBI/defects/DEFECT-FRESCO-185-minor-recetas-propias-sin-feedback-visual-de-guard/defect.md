# DEFECT: [MINOR] Recetas propias: sin feedback visual de "guardando" al crear, solo cambia de color sutilmente

**Jira Key:** [FRESCO-185](https://basiliomontescastano.atlassian.net/browse/FRESCO-185)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: `components/recipes/create-recipe-form.tsx`, botón submit (estado `isSaving`)

## Observado

El botón se deshabilita correctamente durante el guardado, pero el texto sigue diciendo "Guardar receta" sin spinner ni texto "Guardando…" — solo un leve cambio de color de fondo indica actividad.

## Impacto

En conexión lenta el usuario puede pensar que el click no se registró.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
