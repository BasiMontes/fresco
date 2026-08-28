# Tarea: Revisar 4 índices sin uso (candidatos a borrar)

**Jira Key:** [FRESCO-30](https://basiliomontescastano.atlassian.net/browse/FRESCO-30)
**Status:** Finalizada
**Type:** Tarea

---

## Description

Supabase advisors (performance, 2026-08-01) marca 4 índices nunca usados: idx*recipes*alergenos, idx*recipes*ingredientes (tabla recipes), idx*meal*plans*semana (meal*plans), idx*mpr*estado (meal*plan*recipes). Confirmar que de verdad no se usan en ningún query real antes de borrar, o dejarlos si el catálogo va a crecer y empezarán a usarse. Prioridad mínima.

---

## Fields

### Clasificación

0|i0008f:

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
