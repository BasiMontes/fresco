# DEFECT: [MINOR] Calendario: imagen LCP sin loading="eager", warning de consola en /calendar

**Jira Key:** [FRESCO-183](https://basiliomontescastano.atlassian.net/browse/FRESCO-183)
**Priority:** Medium
**Status:** Rechazos
**Components:** None

---

## Description

## Qué se observa

***Severidad******:****** MINOR***

***Dónde***: `components/calendar/calendar-grid.tsx` o el componente de imagen de receta que renderiza dentro

## Observado

La consola muestra un warning de Next.js: una imagen de receta (fuente Unsplash) es detectada como elemento Largest Contentful Paint sin `loading="eager"`.

## Impacto

Perf smell real, afecta el LCP de la página `/calendar`.

---

## Related Issues

- relates to: [FRESCO-10](https://basiliomontescastano.atlassian.net/browse/FRESCO-10) - Calendario Editable

---

## Metadata

- **Created:** 8/11/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
