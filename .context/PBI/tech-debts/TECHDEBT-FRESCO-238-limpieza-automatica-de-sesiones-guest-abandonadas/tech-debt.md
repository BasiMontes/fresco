# Tarea: Limpieza automática de sesiones guest abandonadas

**Jira Key:** [FRESCO-238](https://basiliomontescastano.atlassian.net/browse/FRESCO-238)
**Status:** Listo
**Type:** Tarea

---

## Description

- Usuarios anónimos (guest) que nunca convierten a cuenta quedan para siempre en `auth.users`, sin garbage collection.
- ADR-0003 nombra esto explícitamente como tarea operacional real sin resolver.
- Candidato de solución: job `pg_cron` con umbral de retención a definir explícitamente (no un default silencioso).
- Fuente: master-implementation-plan.md §3, ADR-0003.

---

## Fields

### Clasificación

0|i001i7:

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
