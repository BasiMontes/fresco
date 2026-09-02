# Tarea: A4-PROC · Definicion dura de "Finalizada" (DoD): un ticket no se cierra hasta que el problema es medible-mente cero

**Jira Key:** [FRESCO-404](https://basiliomontescastano.atlassian.net/browse/FRESCO-404)
**Status:** Listo
**Type:** Tarea

---

## Description

Contexto

FRESCO-392 (A4-FWD-ONLY) cerro los 4 cierres forward-only (FRESCO-282 / 313 / 320 / 328) verificando que el trabajo concreto habia aterrizado en H17 y M16-M18. Al hacerlo quedo claro el patron que causo el problema: tarjetas marcadas Finalizada mientras la metrica del hallazgo seguia sin ser cero (defectos sin trazar, AC no testeables, "aislamiento" que en realidad era un deferral).

Objetivo

Escribir y adoptar una Definition of Done dura para el proyecto: un ticket no pasa a Finalizada hasta que el problema que lo origino es medible-mente cero (o el residuo esta explicitamente aceptado y con ticket de seguimiento). Casos: defecto -> repro reproducido y luego no reproducible + evidencia; tarea de datos/backlog -> la consulta de verificacion da 0; decision/deferral -> va a Rechazos con ADR, no a Finalizada.

Alcance

Documentar la DoD (candidatos: .context/ADR/ nuevo ADR de proceso, o seccion en el project-dev-guide / CLAUDE.md). Sin cambio de codigo. Esfuerzo: S.

Origen

Auditoria 4, epic FRESCO-359, ola-3. Referenciado desde el AC de FRESCO-392.

---

## Fields

### Clasificación

0|i002i7:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-09-02T13:06:07.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":2,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 9/2/2026
- **Updated:** 9/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-4, ola-3

---

_Synced from Jira by sync-jira-issues_
