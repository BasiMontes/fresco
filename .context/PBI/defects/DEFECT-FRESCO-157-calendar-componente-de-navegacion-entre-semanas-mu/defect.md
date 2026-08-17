# DEFECT: /calendar: componente de navegación entre semanas muy ancho

**Jira Key:** [FRESCO-157](https://basiliomontescastano.atlassian.net/browse/FRESCO-157)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/calendar/week-navigation.tsx` — controles prev/next de `/calendar` (dos botones circulares `size-9` de 36px + label `min-w-24` de 96px).
- Hallazgo directo del user: el componente para moverse entre semanas es demasiado ancho.

## Cambio propuesto

- Reducir el footprint horizontal: bajar el tamaño de los botones circulares (`size-9` → más chico) y/o el `min-w-24` del label de rango de fechas, sin perder legibilidad ni área táctil mínima.

## Alcance

- Solo `week-navigation.tsx`. No toca `delete-week-button.tsx` (botón separado, mismo header row) ni la lógica de navegación (eso es FRESCO-158).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
