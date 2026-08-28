# Tarea: Catálogo de recetas: definir mecanismo de borrado (DELETE)

**Jira Key:** [FRESCO-237](https://basiliomontescastano.atlassian.net/browse/FRESCO-237)
**Status:** Control de calidad
**Type:** Tarea

---

## Description

- Catálogo de 1000 recetas sin ningún mecanismo de DELETE en la app ni en Edge Functions; una receta mala o duplicada solo se corrige hoy con SQL manual vía `service_role`.
- Requiere decisión de founder: ¿SQL manual sigue siendo aceptable a largo plazo, o hace falta un script/admin real?
- Fuente: master-implementation-plan.md §3 (Master Sprint 0).

---

## Fields

### Clasificación

0|i001hz:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-23T22:21:13.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-24T00:18:12.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":1,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-24T00:21:13.000+0200","topEnvironments":[{"lastUpdated":"2026-08-23T22:21:13.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/24/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
