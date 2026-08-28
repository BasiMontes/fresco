# Tarea: CI: activar required status checks en `main`, `staging` y `dev`

**Jira Key:** [FRESCO-279](https://basiliomontescastano.atlassian.net/browse/FRESCO-279)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 01 (ALTO), eje Testabilidad + Trazabilidad. Es el mayor retorno por hora de toda la auditoría.

## Hallazgo

`gh api repos/BasiMontes/fresco/branches/<rama>/protection` devuelve `404 Required status checks not enabled` en las tres ramas. `rulesets: []`, `enforce_admins: false`. Consecuencia: incluso `repo:check` —el job "bloqueante"— no bloquea un merge, porque ninguna rama lo pide como required check. `pr-check.yml` (FRESCO-266) corre en cada PR pero es puramente informativo.

Mientras esto no cambie, flipear el e2e a bloqueante (FRESCO-266 / rama `ci/FRESCO-266`) modifica el exit code del workflow pero no gatea nada.

## Solución propuesta

Marcar `repo:check` (y, cuando el e2e esté verde de forma estable, `test:e2e`) como required status check en la protección de rama de `main`, `staging` y `dev`.

## Plan de acción

1. Settings → Branches → regla de cada rama → "Require status checks to pass before merging" → añadir `repo:check`.

   O `gh api -X PUT repos/BasiMontes/fresco/branches/<rama>/protection` con el bloque `required*status*checks`.

1. Tener en cuenta el retraso de cola de GitHub Actions (~7–10 min diagnosticado el 26 ago): un PR puede tardar en mostrar el check; no asumir que "no aparece" = falló.
2. Verificar abriendo un PR de prueba con un check en rojo y confirmar que el merge queda bloqueado.

## Retorno esperado

Todos los checks que YA corren (format, lint, types, vars, skills) empiezan a proteger de verdad. ~10 minutos de trabajo. Sin esto, todo lo demás de CI es teatro.

---

## Fields

### Clasificación

0|i001rb:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, build={count=1, dataType=build, failedBuildCount=0, successfulBuildCount=0, unknownBuildCount=1}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-28T23:24:29.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":1,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"}}},"build":{"overall":{"count":1,"lastUpdated":"2026-08-28T23:09:40.000+0200","failedBuildCount":0,"successfulBuildCount":0,"unknownBuildCount":1,"dataType":"build"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/28/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
