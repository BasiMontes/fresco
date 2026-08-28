# Tarea: Stripe: job de reconciliación para webhooks de suscripción perdidos/fallidos

**Jira Key:** [FRESCO-301](https://basiliomontescastano.atlassian.net/browse/FRESCO-301)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Contexto

Descubierto durante la regeneración de `business-data-map` / `business-api-map` (PR #169). `ADR-0007` acepta el webhook de Stripe (`POST /api/stripe/webhook`) como el ***único*** camino de escritura hacia el estado de suscripción en `user*profiles` (`plan`, `plan*expires*at`, `stripe*customer*id`, `stripe*subscription*id`, `payment*failed_at`).

## Hallazgo

***No hay job de reconciliación.*** Si un webhook se pierde o falla (timeout, 5xx transitorio, evento no entregado), `user_profiles` diverge de Stripe de forma permanente y silenciosa — nadie lo detecta hasta que el usuario se queja. Los 3 cron jobs actuales son `cleanup-abandoned-guest-users`, `send-weekly-reengagement-push` y `cleanup-expired-rate-limits`; ninguno toca Stripe.

Stripe reintenta las entregas fallidas durante ~3 días, así que la ventana de riesgo real es acotada, pero un evento nunca entregado (endpoint caído >3 días, o mal configurado) se pierde para siempre.

## Solución propuesta (a decidir)

Opciones:

1. `pg*cron`*** diario*** que llame a una Edge Function que consulta la Stripe API (`subscriptions.list`) para cada `stripe*customer*id` con suscripción activa y reconcilia `plan` / `plan*expires*at` / `payment*failed*at`. Reusa el patrón `pg*cron → pg_net → Edge Function` de `send-weekly-reengagement-push` (ADR-0011).
2. ***Endpoint de reconcile manual*** (admin-gated) que hace lo mismo bajo demanda, sin cron.
3. ***Ambos*** — cron para el caso general + endpoint para forzar.

Necesita un ADR (o extensión de ADR-0007) que fije el enfoque, y decidir la frecuencia.

## Retorno esperado

El estado de suscripción deja de poder quedar desincronizado de forma indetectable. Requisito real antes de tener volumen de pago (hoy 0 suscriptores Pro).

---

## Fields

### Clasificación

0|i001vz:

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=4}, build={count=1, dataType=build, failedBuildCount=0, successfulBuildCount=1, unknownBuildCount=0}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-28T19:56:45.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":4,"lastUpdated":"2026-08-28T10:51:54.000+0200","stateCount":4,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":2,"name":"GitHub"},"GitHub":{"count":2,"name":"GitHub"}}},"build":{"overall":{"count":1,"lastUpdated":"2026-08-28T10:51:36.000+0200","failedBuildCount":0,"successfulBuildCount":1,"unknownBuildCount":0,"dataType":"build"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-28T21:56:45.000+0200","topEnvironments":[{"lastUpdated":"2026-08-28T19:56:45.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/28/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
