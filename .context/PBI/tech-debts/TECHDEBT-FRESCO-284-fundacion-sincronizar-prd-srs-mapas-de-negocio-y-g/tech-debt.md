# Tarea: Fundación: sincronizar PRD, SRS, mapas de negocio y glosario con las 5 épicas de agosto

**Jira Key:** [FRESCO-284](https://basiliomontescastano.atlassian.net/browse/FRESCO-284)
**Status:** Merged
**Type:** Tarea

---

## Description

## Contexto

Re-auditoría 27 ago 2026, hallazgo 06 (MEDIO), eje Fundación (bajó de 5,0 a 3,5, casi todo por esto).

## Hallazgo

PRD, SRS, mapas de negocio y glosario congelados a mediados de agosto, ciegos a cinco épicas: Stripe (227), Centro de Avisos (223), analytics/PostHog (240), push/VAPID (241), Sentry (242).

- `PRD/mvp-scope.md` sigue describiendo el pago como "concierge manual / founder checklist" cuando ***ADR-0007 dice literalmente que EPIC-FRESCO-227 revierte esa postergación***. El criterio de éxito MVP sigue siendo "3 de 10 del cohorte concierge pagan".
- `SRS/non-functional-requirements.md`: `rate.limit|sentry|observability|monitoring` = 0 coincidencias. ADR-0009 (Sentry), ADR-0013 (PostHog), ADR-0010 (rate-limiting) son preocupaciones NFR y no están.
- `business/*-map.md`: Stripe/Sentry/PostHog/push/pg_cron = 0 en los tres mapas.
- `domain-glossary.md`: `Suscripción`, `Stripe`, `trial`, `webhook`, `analytics`, `PostHog`, `push`, `aviso` = 0 términos. CLAUDE.md dice que el glosario se consulta antes de escribir AC.

Contrapunto: los 14 ADRs SÍ están al día (3/3 spot-checks contra código pasan). La deriva es de los docs narrativos, no de las decisiones.

## Plan de acción

1. Correr `/business-data-map`, `/business-feature-map`, `/business-api-map`.
2. Actualizar `mvp-scope.md` (reversión del pago self-serve) y `non-functional-requirements.md` (rate-limiting, observabilidad).
3. Añadir términos de glosario para suscripción / centro de avisos / analytics / push (append-only, barato).
4. Adoptar la Regla 16 de CLAUDE.md: hacer esto al cerrar cada épica, no en lote.

## Retorno esperado

El glosario y los mapas vuelven a ser fuente fiable para planificar y escribir AC. Evita que la deriva crezca con cada épica.

---

## Fields

### Clasificación

0|i001sf:

### customfield_10000

{repository={count=4, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":4,"lastUpdated":"2026-08-27T23:11:00.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":4,"name":"GitHub"},"GitHub":{"count":4,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/27/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** auditoria-2

---

_Synced from Jira by sync-jira-issues_
