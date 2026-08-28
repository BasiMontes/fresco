# Tarea: Completar fotos de recetas vía Unsplash (626/1000 hecho)

**Jira Key:** [FRESCO-31](https://basiliomontescastano.atlassian.net/browse/FRESCO-31)
**Status:** WIP
**Type:** Tarea

---

## Description

Backfill de `foto_url` en `recipes` vía Unsplash API (gratis, 50 búsquedas/hora). Script real: `scripts/fetch-recipe-photos.ts` (v10, en el repo, no en scratchpad). Contexto completo del historial de versiones y decisiones en `.context/bitacora.md`, entradas "FRESCO-31" desde 2026-08-01.

***Progreso actual***: 772/1000 completadas, 228 restantes.

Causa raíz del hit-rate bajo (confirmada en vivo, v9): no era problema de traducción/relevancia — el generador combinatorio de nombres produce decenas de variantes que colapsan a la misma query traducida una vez que `FILLER_PHRASES` limpia el modificador genérico, saturando el pool de página 1 de Unsplash para esos conceptos. v9 añadió reintento en página 2 cuando página 1 viene llena y agotada. v10 añadió un segundo nivel de query (`broadenQuery`): si la query precisa se agota, reintenta con solo las 2 primeras palabras de contenido, sin el sesgo "cooked meal" — corpus mucho más amplio, a cambio de menos precisión (decisión explícita del user: prioridad ahora es cobertura, un pase de pulido manual corrige fotos que no correspondan). Validado en vivo: dos tandas a 22/30 y 14/30, recuperando del colapso a 1-3/30 que tenía antes del fix.

Alternativa sin tocar el script: pedir acceso "production" a Unsplash (5000/hora, gratis, con revisión manual de ellos) para completar el resto en pocas tandas en vez de a razón de 50/hora.

Resuelto, ya no es alcance pendiente: conectar foto*url a la UI real — RecipeCard ya usa la foto real cuando existe (components/recipe/recipe-card.tsx), placeholder de categoría solo cuando foto*url es null.

---

## Fields

### Clasificación

0|i0008n:

### customfield_10000

{deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-13T10:24:21.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, repository={count=43, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":43,"lastUpdated":"2026-08-26T01:34:54.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":43,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":43,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-13T12:24:21.000+0200","topEnvironments":[{"lastUpdated":"2026-08-13T10:24:21.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
