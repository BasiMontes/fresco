# Tarea: Onboarding: añadir presupuesto semanal estimado en el paso de hogar

**Jira Key:** [FRESCO-134](https://basiliomontescastano.atlassian.net/browse/FRESCO-134)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

En el último paso del onboarding ("¿Quiénes cocináis en casa?" — futuro paso 4 tras el rediseño de FRESCO-132), añadir un campo de presupuesto semanal estimado, para acercar la generación del menú al límite de gasto del usuario.

## Dónde

`app/onboarding/page.tsx:310-344` (bloque `step === 3`, futuro `step === 4`)

## Qué añadir

Input numérico de "Presupuesto semanal (estimado)", junto a los campos de Adultos/Niños ya existentes.

## Criterios de aceptación

- El presupuesto semanal se guarda y persiste junto al resto de datos del onboarding.
- Se envía junto al resto del payload de onboarding hacia el backend.
- El campo se marca explícitamente como estimado en la UI (no se garantiza ajuste exacto de precio).

## Fuera de alcance (por ahora)

Cómo obtener el precio real de los productos/ingredientes queda ***fuera de esta tarea*** — es un problema aparte, pendiente de definir (fuente de datos de precios, actualización, etc.). Esta tarea solo cubre capturar el presupuesto declarado por el usuario; el uso real de ese dato para ajustar el menú generado depende de resolver esa fuente de precios primero.

---

## Fields

### Clasificación

0|i000d3:000002

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:16:57.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-09T14:19:37.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"},"GitHub":{"count":1,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:16:57.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:16:57.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
