# Tarea: Añadir tests unitarios a consolidator.ts y aisle-pricing.ts

**Jira Key:** [FRESCO-34](https://basiliomontescastano.atlassian.net/browse/FRESCO-34)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de deuda técnica de sesión.

***Qué:*** `supabase/functions/generate-shopping-list/consolidator.ts` (318 líneas) y `aisle-pricing.ts` (415 líneas) — la lógica determinista que reemplazó las llamadas a Gemini esta misma sesión — no tienen ningún archivo `.test.ts`.

***Por qué importa:*** es la lógica de negocio más nueva y de mayor riesgo del repo (consolidación de cantidades por 200 ingredientes reales + clasificación de pasillos + estimación de coste). Ya hubo un bug real detectado manualmente en esta sesión (precios multiplicados por gramos reales en vez de por unidad, disparando totales a miles de euros) — exactamente el tipo de regresión que un test hubiera atajado antes de deploy.

***Qué cubrir:*** consolidación de cantidades (unidades compatibles/incompatibles, escalado por raciones), normalización de nombres (tildes), clasificación por pasillo (casos con y sin match, fallback a 'Otros'), cálculo de coste*estimado*min/max.

***Severidad:*** alta relevancia / esfuerzo medio.

---

## Fields

### Clasificación

0|i0009b:

### customfield_10000

{repository={count=1, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":1,"lastUpdated":"2026-08-02T00:51:23.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":1,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
