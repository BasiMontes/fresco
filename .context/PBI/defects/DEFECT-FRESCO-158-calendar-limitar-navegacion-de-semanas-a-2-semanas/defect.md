# DEFECT: /calendar: limitar navegación de semanas a ±2 semanas (ventana de 5)

**Jira Key:** [FRESCO-158](https://basiliomontescastano.atlassian.net/browse/FRESCO-158)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/calendar/week-navigation.tsx` — los links "Semana anterior"/"Semana siguiente" navegan sin límite (`addIsoWeeks(semanaIso, -1)` / `addIsoWeeks(semanaIso, 1)`, siempre activos).
- Hallazgo directo del user: solo debería poder moverse dentro de un rango de 5 semanas — 2 semanas atrás, 2 adelante, más la actual (Semana pasada 2, Semana pasada 1, Semana actual, Semana futura, Semana futura 2).

## Cambio propuesto

- Calcular el offset entre la semana actual real (`getIsoWeekMonday(new Date())`) y `mondayIso` (la semana que se está viendo). Deshabilitar (no ocultar, para no romper el layout) el link "Semana anterior" cuando el offset ya es -2, y "Semana siguiente" cuando ya es +2 — así el usuario nunca puede navegar fuera de esa ventana de 5 semanas.

## Alcance

- Solo la lógica de límites en `week-navigation.tsx`. No cambia `addIsoWeeks`/`getIsoWeekMonday` (`lib/date/iso-week.ts`) — se consumen tal cual existen. No toca el ancho visual (eso es FRESCO-157).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
