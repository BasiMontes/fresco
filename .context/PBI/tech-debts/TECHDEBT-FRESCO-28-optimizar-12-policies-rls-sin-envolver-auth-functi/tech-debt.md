# Tarea: Optimizar 12 policies RLS sin envolver auth.<function>() en (select ...)

**Jira Key:** [FRESCO-28](https://basiliomontescastano.atlassian.net/browse/FRESCO-28)
**Status:** Finalizada
**Type:** Tarea

---

## Description

Supabase advisors (performance, 2026-08-01): 12 policies RLS en user*profiles, meal*plans, meal*plan*recipes y shopping*lists re-evalúan auth.<function>()/current*setting() por cada fila en vez de una vez por query. Reemplazar auth.<function>() por (select auth.<function>()) en cada policy. No urgente a escala concierge (8-10 usuarios), pero es deuda técnica real de cara a escalar.

---

## Fields

### Clasificación

0|i0007z:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/1/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
