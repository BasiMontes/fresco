# Tarea: Jira: rellenar los campos de QA estructurada en el trabajo nuevo

**Jira Key:** [FRESCO-281](https://basiliomontescastano.atlassian.net/browse/FRESCO-281)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 03 (ALTO), eje Backlog. Lectura directa del tablero vía acli — la parte que el baseline no pudo ver.

## Hallazgo

Board-wide, sobre los 262 work items: ***Acceptance Test Plan, Acceptance Test Results, Severity, Root Cause, Error Type, Actual/Expected Result, Evidence, Story Points → 0 rellenos cada uno.*** Solo Business Rules tiene un valor (FRESCO-82). Todo —AC, alcance, plan de pruebas, resultado de QA— vive en comentarios de texto libre.

El límite de 255 caracteres de la instancia excusa a AC/Scope/OOS/Rules (workaround documentado en `dev-roadmap.md §6`). ***No excusa*** a ATP/ATR/Severity/Root Cause/Error Type/Story Points — son campos de opción o número sin ese límite, y están igual de vacíos. Para un proyecto cuya tesis es shift-left QA, los artefactos que harían QA medible no existen en forma consultable.

## Solución propuesta

Empezar a poblar cuatro campos sin límite —***Severity, Root Cause, Error Type, Story Points***— solo en el trabajo nuevo. No rellenar hacia atrás los 220 items terminados.

## Plan de acción

1. Añadir al flujo de `/sprint-development` y `/product-management`: al crear un bug, set Severity + Error Type; al cerrarlo, set Root Cause.
2. Al refinar una historia, set Story Points.
3. Re-evaluar ATP/ATR cuando el repo de QA entre en juego (ahí sí son la moneda de cambio).

## Retorno esperado

Desbloquea dashboards JQL y triaje por severidad. Coste casi cero por item. Sin esto no hay velocidad ni densidad de defectos por feature.

---

## Fields

### Clasificación

0|i001rr:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, build={count=1, dataType=build, failedBuildCount=0, successfulBuildCount=0, unknownBuildCount=1}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-27T15:39:43.000+0000, id=0, position=0, title=Preview, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-08-27T21:51:03.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":2,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"}}},"build":{"overall":{"count":1,"lastUpdated":"2026-08-27T17:39:39.000+0200","failedBuildCount":0,"successfulBuildCount":0,"unknownBuildCount":1,"dataType":"build"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-27T17:39:43.000+0200","topEnvironments":[{"lastUpdated":"2026-08-27T15:39:43.000+0000","id":0,"position":0,"title":"Preview","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
