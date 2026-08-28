# Tarea: CI: el e2e muta un backend Supabase compartido — race entre jobs solapados

**Jira Key:** [FRESCO-289](https://basiliomontescastano.atlassian.net/browse/FRESCO-289)
**Status:** Listo
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 11 (MEDIO), eje Testabilidad. Es también una cuarta señal de revisión para ADR-0014 (ver ticket 17).

## Hallazgo

El job e2e de `pr-check.yml` no fija `PLAYWRIGHT*BASE*URL` (corre contra un `next dev` local) pero los servicios salen de `secrets.ENV_FILE` — un ***único proyecto Supabase*** (`jdqemhewjrjuopssdurn`, el único referenciado en todo el repo).

Los steps ***mutan ese backend compartido****: `reseedCurrentWeekPlan()` borra + regenera el `meal*plans` del usuario QA; los steps `@suscripcion` hacen writes service-role a `user*profiles.plan`. Dos PRs cuyos runs de CI se solapan compiten por las mismas filas. `workers:1` arregla las races intra-run, no las inter-job. ****Es la clase exacta de bug que ****`workers:1`**** se introdujo para matar, recreada a nivel de job*** — latente hasta que suba el throughput de PRs.

## Solución propuesta

Opciones (de menor a mayor esfuerzo):

1. Serializar el job e2e (concurrency group en el workflow) — parche.
2. Factorías de datos por test (cada test crea su propio plan / usuario) — arreglo real, y retira `workers:1` de paso.
3. Proyecto Supabase efímero por run de CI.

## Retorno esperado

CI e2e fiable cuando haya más de un PR abierto a la vez. La opción 2 además desbloquea la ejecución en paralelo local.

---

## Fields

### Clasificación

0|i001tj:

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
