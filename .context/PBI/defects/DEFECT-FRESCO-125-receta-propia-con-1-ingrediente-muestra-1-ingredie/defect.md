# DEFECT: Receta propia con 1 ingrediente muestra '1 ingredientes' (pluralización)

**Jira Key:** [FRESCO-125](https://basiliomontescastano.atlassian.net/browse/FRESCO-125)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

Qué se observa

Dónde: components/recipes/personal-recipe-card.tsx (pluralización de "ingrediente(s)")

Pasos para reproducir:
1. Crear o ver una receta propia con exactamente 1 ingrediente.

Esperado: "1 ingrediente".

Observado: "1 ingredientes" — pluralización naive (siempre añade "s"), sin caso especial para singular.

Por qué importa

Cosmético, baja severidad, pero visible en cualquier receta propia con 1 solo ingrediente.

Alcance

Añadir el caso singular: `${count} ${count === 1 ? 'ingrediente' : 'ingredientes'}`.

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** minor, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
