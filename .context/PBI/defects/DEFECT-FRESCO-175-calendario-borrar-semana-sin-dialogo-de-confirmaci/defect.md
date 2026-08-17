# DEFECT: Calendario: borrar semana sin diálogo de confirmación

**Jira Key:** [FRESCO-175](https://basiliomontescastano.atlassian.net/browse/FRESCO-175)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/calendar/delete-week-button.tsx` — `handleDelete()` borra el plan de la semana inmediatamente al click, sin diálogo de confirmación.
- Hallazgo del QA sweep (agente Calendario, MINOR): acción irreversible (borra las 21 franjas de la semana) con cero fricción "¿estás seguro?".

## Cambio propuesto

- Agregar un diálogo de confirmación (mismo patrón `Dialog`/`ConfirmModal` ya usado en otras acciones destructivas de la app, ej. `delete-account-dialog.tsx`) antes de ejecutar el borrado.

## Alcance

- Solo `delete-week-button.tsx`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
