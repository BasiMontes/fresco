# Tarea: Fix suite e2e: 8 escenarios rotos por drift + 4 escenarios nuevos (FRESCO-191/194/170)

**Jira Key:** [FRESCO-195](https://basiliomontescastano.atlassian.net/browse/FRESCO-195)
**Status:** Listo
**Type:** Tarea

---

## Description

## Qué

Investigación pedida por el user ("algún escenario nuevo para automatizar" → se encontraron 8/17 e2e fallando, no solo lo nuevo). Triage completo + fix de las 8 fallas reales + 4 escenarios nuevos.

## Fallas reales encontradas y corregidas

1. ***@******seguridad***: `get*recent*recipe*ids` renombrada a `get*recent*recipe*marks` en FRESCO-120 (migración `20260808010000`), test nunca actualizado.
2. ***@******lista-compra***: assertion buscaba texto viejo "X productos · estimado Y-Z EUR", reemplazado por el rediseño de FRESCO-191 (card Resumen separada en pendientes + total).
3. ***@******generacion-menu / ******@******registro-progresivo*** (2 escenarios, misma causa): onboarding ganó un 4to paso (cocinas favoritas separado), tests solo hacían 2 clicks en "Siguiente" en vez de 3 — nunca llegaban al botón "Generar mi menú".
4. ***@******generacion-menu edge-case***: cuenta de test (`PRO*TEST*USER*EMAIL`) tenía `planning*meals` reducido a `{comida,cena}` por estado filtrado de otra sesión — `/menu` nunca renderizaba el slot de desayuno. Reset agregado al fixture.
5. ***@******calendario edge-case***: escenario arrastraba desde un slot de desayuno — FRESCO-159 quitó el handle de arrastre de desayuno por completo. Cambiado el origen a "comida" (mismo chequeo real de tipo distinto, origen que sigue siendo arrastrable). Mismo problema en `entrega-parcial.steps.ts` (assertion esperaba `disabled`, ahora es `toHaveCount(0)`).
6. ***@******registro***: checkbox de Términos y Condiciones agregado a `/signup` después de escrito este test — bloqueaba el submit real antes de llegar a la red.

## Escenarios nuevos agregados

- Precio por producto (FRESCO-191, segunda vuelta)
- Vaciar comprados (FRESCO-191, QA rework)
- Sugerencias por favoritos + Añadir (FRESCO-194)
- Scroll táctil horizontal mobile del calendario — guarda de regresión de FRESCO-170 (BLOCKER encontrado DOS veces por QA sweeps reales antes de arreglarse de verdad), cero cobertura existía.

## Gotcha de tooling encontrado

`playwright-bdd`'s `.features-gen/` quedó con cache de 6 días (mtime 8 ago) pese a cambios reales en `regression.feature` — `bunx bddgen test` hace falta correrlo a mano cuando el cache no se regenera solo antes de `playwright test`.

## Verificación

`bun run test:e2e` — 21/21 pasan, corrida limpia sin interferencia concurrente.

---

## Fields

### Clasificación

0|i0018v:

### customfield_10000

{repository={count=3, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":3,"lastUpdated":"2026-08-14T20:36:47.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"},"GitHub":{"count":3,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/14/2026
- **Updated:** 8/14/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
