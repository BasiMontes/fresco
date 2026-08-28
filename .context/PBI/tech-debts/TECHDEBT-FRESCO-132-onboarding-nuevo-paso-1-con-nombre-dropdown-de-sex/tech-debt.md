# Tarea: Onboarding: nuevo paso 1 con nombre, dropdown de sexo y dropdown de objetivo

**Jira Key:** [FRESCO-132](https://basiliomontescastano.atlassian.net/browse/FRESCO-132)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

Ampliar alcance: el onboarding pasa de 3 a 4 pasos. Se añade un ***nuevo paso 1*** con nombre, sexo y objetivo del usuario. Los pasos actuales (dieta/restricciones, cocinas favoritas, quiénes cocináis) pasan a ser paso 2, 3 y 4.

## Qué añadir (nuevo paso 1)

- Input de texto para ***nombre***.
- Dropdown de ***sexo*** con el componente de diseño propio del sistema (NO el `<select>` nativo del navegador).
- Dropdown de ***objetivo*** (también componente custom), con opciones sugeridas:

  (validar la lista final de opciones con el equipo antes de implementar — la propuesta busca cubrir los objetivos más comunes para focalizar la recomendación de recetas)

## Dónde

`app/onboarding/page.tsx` — insertar nuevo bloque `step === 1`, renumerar los `step ===` existentes (1→2, 2→3, 3→4) y actualizar el indicador "PASO X DE 3" → "PASO X DE 4" + barra de progreso (3 segmentos → 4).

## Criterios de aceptación

- Nombre, sexo y objetivo se guardan y persisten junto al resto de datos del onboarding.
- Los tres campos usan componentes del design system, no controles nativos del navegador.
- El indicador de progreso y la numeración de pasos reflejan correctamente 4 pasos totales.
- Los datos se envían junto al resto del payload de onboarding hacia el backend.

## Notas

Revisar `.context/design/master-design-plan.md` para el componente de dropdown ya ratificado del design system antes de implementar.

---

## Fields

### Clasificación

0|i000d3:000004

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=12}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:16:57.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":12,"lastUpdated":"2026-08-26T13:09:54.000+0200","stateCount":12,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":6,"name":"GitHub"},"GitHub":{"count":6,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:16:57.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:16:57.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
