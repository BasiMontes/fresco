# Tarea: Testing / infra: limpieza menor (trace vs retries, tag muerto, hueco ADR-0010)

**Jira Key:** [FRESCO-292](https://basiliomontescastano.atlassian.net/browse/FRESCO-292)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgos 16 y 17 + notas (BAJO), eje Testabilidad.

## Hallazgo

1. `playwright.config.ts:54`: `trace: 'on-first-retry'` con `retries` sin fijar (default 0) → la config de trace-on-retry nunca dispara. Los fallos de CI no dejan traza.
2. `regression.feature`: `@no-implementado` es ahora un tag muerto (0 escenarios lo llevan) pero el bloque de convención del header aún lo documenta. Tags malformados `@verificado-manual` y `@verificado-manual-` (1 cada uno).
3. ***Hueco de ADR-0010 en ***`main`: ADR-0010 (rate-limiting) vive en la rama sin mergear `feat/FRESCO-243-rate-limiting-generacion-menu` mientras 0011–0013 se mergearon por delante. Si otra sesión redacta un ADR nuevo mirando `main` y toma el "0010", colisión al mergear FRESCO-243.

## Plan de acción

1. `retries: process.env.CI ? 1 : 0` en `playwright.config.ts`, o cambiar a `trace: 'retain-on-failure'`.
2. Quitar `@no-implementado` del header de `regression.feature`; corregir los 2 tags malformados.
3. Reservar el número 0010 explícitamente (comentario en `.context/ADR/README.md`) o añadir un check de numeración a la doctrina de ADRs.

## Retorno esperado

Trazas de fallo en CI. Menos ruido en el fichero de escenarios. Sin sorpresas de numeración al mergear FRESCO-243.

---

## Fields

### Clasificación

0|i001u7:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
