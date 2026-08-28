# DEFECT: [MINOR] Calendario: columnas de días cortadas sin indicio visual de scroll en tablet/desktop

**Jira Key:** [FRESCO-184](https://basiliomontescastano.atlassian.net/browse/FRESCO-184)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: `components/calendar/calendar-grid.tsx`

## Observado

En 768px y 1280px, la última columna de día visible queda cortada a mitad de tarjeta, sin gradiente/scrollbar/indicio de que hay más días a la derecha. El drag-to-reorder es la interacción documentada, pero el scroll horizontal no está señalizado.

## Esperado

Algún indicio visual (gradiente, sombra, flecha) de que hay contenido scrolleable.

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
