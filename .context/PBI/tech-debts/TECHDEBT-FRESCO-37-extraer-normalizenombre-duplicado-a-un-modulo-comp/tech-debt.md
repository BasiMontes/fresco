# Tarea: Extraer normalizeNombre() duplicado a un módulo compartido

**Jira Key:** [FRESCO-37](https://basiliomontescastano.atlassian.net/browse/FRESCO-37)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de deuda técnica de sesión.

***Qué:*** la función de normalización de nombres (quitar tildes, minúsculas, trim) está definida de forma independiente en `supabase/functions/generate-shopping-list/consolidator.ts:236` y en `aisle-pricing.ts:32` — el segundo archivo incluso tiene un comentario reconociendo la duplicación ('Same normalization consolidator.ts applies') en vez de importar una implementación compartida.

***Por qué importa:*** un fix futuro de tildes/edge-case en una copia no se propaga automáticamente a la otra — riesgo real de divergencia silenciosa.

***Cómo:*** mover a `supabase/functions/_shared/` e importar desde ambos archivos.

***Severidad:*** esfuerzo pequeño.

---

## Fields

### Clasificación

0|i0009z:

### customfield_10000

{repository={count=2, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":2,"lastUpdated":"2026-08-02T00:53:21.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":2,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
