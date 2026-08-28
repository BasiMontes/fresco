# Tarea: Onboarding: inputs de texto libre en dieta, alérgenos, ingredientes que no gustan y cocinas favoritas

**Jira Key:** [FRESCO-133](https://basiliomontescastano.atlassian.net/browse/FRESCO-133)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

Añadir un input de texto libre debajo de cada grupo de chips en el onboarding, para que el usuario pueda escribir algo que no está cubierto por las opciones predefinidas. Cubre 4 grupos en total, repartidos en 2 pasos (numeración de pasos tras el rediseño de FRESCO-132: nombre/sexo/objetivo = paso 1, dieta/restricciones = paso 2, cocinas favoritas = paso 3).

## Dónde

- `app/onboarding/page.tsx:225-284` (bloque `step === 1`, futuro `step === 2` — dieta/restricciones)
- `app/onboarding/page.tsx:288-308` (bloque `step === 2`, futuro `step === 3` — cocinas favoritas)

## Qué añadir

Un input de texto libre debajo de cada uno de estos 4 grupos:

1. Debajo de los chips de dieta y restricciones ("Vegetariano", "Vegano", "Sin gluten"...).
2. Debajo de los chips de alérgenos ("Gluten", "Huevo", "Pescado"...).
3. Debajo de los chips de ingredientes que no gustan ("Cebolla", "Champiñones", "Setas"...).
4. Debajo de los chips de cocinas favoritas ("Española", "Italiana", "Mexicana"...).

## Criterios de aceptación

- Cada uno de los 4 grupos tiene su propio input de texto libre, independiente de los demás.
- El contenido de cada input se guarda y persiste junto al resto de datos del onboarding.
- Los cuatro campos se envían junto al resto del payload de onboarding hacia el backend, diferenciados por grupo.

---

## Fields

### Clasificación

0|i000d3:000006

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:16:57.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-09T14:06:26.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"},"GitHub":{"count":1,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:16:57.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:16:57.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
