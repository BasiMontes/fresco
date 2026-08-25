# Tarea: Monitoreo de errores en producción (error tracking)

**Jira Key:** [FRESCO-242](https://basiliomontescastano.atlassian.net/browse/FRESCO-242)
**Status:** Control de calidad
**Type:** Tarea

---

## Description

- No existe Sentry ni equivalente en el repo.
- `app/error.tsx` y `global-error.tsx` solo cubren error boundaries nativos de Next.js en cliente; nadie se entera de errores reales en producción salvo barrido manual de QA.
- Fuente: verificado por búsqueda de código, gap no documentado previamente en master-implementation-plan.md.

---

## Fields

### Clasificación

0|i001j3:

### customfield_10000

{repository={count=9, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":9,"lastUpdated":"2026-08-23T18:36:42.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":9,"name":"GitHub"},"GitHub":{"count":9,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/23/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
