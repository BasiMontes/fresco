# Tarea: Recetas propias: permitir editar y borrar receta propia

**Jira Key:** [FRESCO-236](https://basiliomontescastano.atlassian.net/browse/FRESCO-236)
**Status:** Listo
**Type:** Tarea

---

## Description

- Usuario no puede editar ni borrar una receta propia creada por él mismo; el único camino actual es borrar la cuenta entera.
- `recipe-detail.tsx:133` documenta este gap como fuera de scope (OOS) en su momento, sin fecha de retoma.
- RLS ya tiene políticas `own` para INSERT/SELECT en `recetas_propias`; UPDATE/DELETE seguirían el mismo patrón.
- Fuente: master-implementation-plan.md §3 (Master Sprint 1).

---

## Fields

### Clasificación

0|i001hr:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/20/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
