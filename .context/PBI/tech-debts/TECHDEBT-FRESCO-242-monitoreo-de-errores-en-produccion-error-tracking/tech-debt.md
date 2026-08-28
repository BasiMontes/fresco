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

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-08-27T21:51:07.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"},"GitHub":{"count":2,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/23/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
