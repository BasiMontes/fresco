# Tarea: Acotar CORS de Edge Functions a los dominios reales de la app

**Jira Key:** [FRESCO-33](https://basiliomontescastano.atlassian.net/browse/FRESCO-33)
**Status:** Finalizada
**Type:** Tarea

---

## Description

***Origen:*** auditoría de seguridad de sesión.

***Qué:**** `supabase/functions/_shared/cors.ts` responde `Access-Control-Allow-Origin: **` para todas las Edge Functions.

***Por qué importa:*** riesgo bajo hoy porque la auth es bearer JWT en header, no cookie (el wildcard no habilita session riding). Pero sí permite que JS de cualquier origen lea las respuestas JSON si un token de usuario llega a exponerse en ese origen (ej. XSS en otro lado). Buena práctica acotarlo aunque el riesgo actual sea limitado.

***Cómo:*** reemplazar el wildcard por una whitelist de los dominios reales de producción/staging (Vercel), leídos de config/env, no hardcodeados.

***Severidad:*** baja (hygiene), esfuerzo pequeño.

---

## Fields

### Clasificación

0|i00093:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-14T16:53:21.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"GitHub":{"count":1,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/1/2026
- **Updated:** 8/2/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
