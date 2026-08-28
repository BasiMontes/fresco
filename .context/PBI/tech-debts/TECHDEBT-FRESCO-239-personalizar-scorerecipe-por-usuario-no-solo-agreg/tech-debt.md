# Tarea: Personalizar scoreRecipe() por usuario (no solo agregado global)

**Jira Key:** [FRESCO-239](https://basiliomontescastano.atlassian.net/browse/FRESCO-239)
**Status:** Control de calidad
**Type:** Tarea

---

## Description

- La heurística de calidad de receta usa hoy columnas globales (`rating*promedio`, `veces*cocinada`), no una señal por usuario.
- ADR-0006 difirió esto explícitamente como "un cambio separado y más grande", pendiente de spike de diseño (nuevo storage de rating per-user).
- Fuente: master-implementation-plan.md §3/§9, ADR-0006.

---

## Fields

### Clasificación

0|i001if:

### customfield_10000

{repository={count=7, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":7,"lastUpdated":"2026-08-23T17:53:23.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":7,"name":"GitHub"},"GitHub":{"count":7,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/20/2026
- **Updated:** 8/23/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
