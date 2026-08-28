# Tarea: Limpieza automática de sesiones guest abandonadas

**Jira Key:** [FRESCO-238](https://basiliomontescastano.atlassian.net/browse/FRESCO-238)
**Status:** Finalizada
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

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=6}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-23T17:09:06.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":6,"lastUpdated":"2026-08-27T23:11:16.000+0200","stateCount":6,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"},"GitHub":{"count":3,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-23T19:09:06.000+0200","topEnvironments":[{"lastUpdated":"2026-08-23T17:09:06.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
