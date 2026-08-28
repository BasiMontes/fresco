# Tarea: Onboarding: tooltip explicando por qué Vegetariano se bloquea al elegir Vegano

**Jira Key:** [FRESCO-131](https://basiliomontescastano.atlassian.net/browse/FRESCO-131)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

En el paso 1 del onboarding (dieta y restricciones), al seleccionar "Vegano" el chip "Vegetariano" se auto-selecciona y queda bloqueado (`disabled`) — comportamiento intencional (AC-2: vegano implica vegetariano, ver `app/onboarding/page.tsx:231-234`). Sin explicación visual, el usuario no entiende por qué no puede desmarcar "Vegetariano".

## Dónde

`app/onboarding/page.tsx:230-249` (bloque `DIETA_OPTIONS.map`)

## Qué añadir

Tooltip (o texto de ayuda accesible) en el chip "Vegetariano" cuando está bloqueado, explicando: "Vegano incluye vegetariano — todas las recetas veganas son también vegetarianas".

## Criterios de aceptación

- Al pasar el cursor/foco sobre el chip "Vegetariano" bloqueado, se muestra un tooltip con la explicación.
- En móvil (sin hover), el tooltip debe ser accesible por toque o mostrarse un icono de info junto al chip.
- El tooltip usa el componente de diseño del sistema, no el `title` nativo del navegador.

---

## Fields

### Clasificación

0|i000un:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:16:57.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-08-09T13:36:54.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"},"GitHub":{"count":2,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:16:57.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:16:57.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
