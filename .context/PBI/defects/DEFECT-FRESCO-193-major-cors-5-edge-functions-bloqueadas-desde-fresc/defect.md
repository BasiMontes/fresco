# DEFECT: [MAJOR] CORS: 5 Edge Functions bloqueadas desde fresco-pre.vercel.app

**Jira Key:** [FRESCO-193](https://basiliomontescastano.atlassian.net/browse/FRESCO-193)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué

`generate-shopping-list` (y las otras 4 Edge Functions que comparten `_shared/cors.ts`: `generate-meal-plan`, `update-recipe-status`, `delete-account`, `reassign-guest-data`) bloqueadas por CORS al llamarse desde `fresco-pre.vercel.app`. Consola: `Access to fetch ... has been blocked by CORS policy: ... No 'Access-Control-Allow-Origin' header is present`.

## Por qué

`ALLOWED*ORIGINS` en `supabase/functions/*shared/cors.ts` solo tenía `fresco-pro.vercel.app` + `localhost:3000`. Faltaban `fresco-pre.vercel.app` (segundo alias del mismo deployment de producción, usado para QA desde 2026-08-04 según bitácora) y `fresco-staging.vercel.app` (URL de staging documentada en `.agents/project.yaml`, nunca agregada).

## Fix

Agregados los dos orígenes faltantes al Set. Redeployadas las 5 funciones afectadas (bundlean su propio árbol de dependencias — un cambio en `_shared/cors.ts` no tiene efecto hasta redeployar cada una). Verificado: preflight OPTIONS real devuelve `Access-Control-Allow-Origin: https://fresco-pre.vercel.app`; POST real desde ese origen ya no es bloqueado por CORS (llega al servidor, 401 esperado por falta de auth en el fetch de prueba).

---

## Metadata

- **Created:** 8/14/2026
- **Updated:** 8/17/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
