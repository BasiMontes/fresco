# Tarea: Crear la pantalla de notificaciones

**Jira Key:** [FRESCO-72](https://basiliomontescastano.atlassian.net/browse/FRESCO-72)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Confirmado: la pantalla no existe

No hay `app/notifications` (ni ruta similar) en el repo. Ningún componente relacionado.

## Entry point muerto ya existente

`app/(app)/menu/page.tsx:117-119` — botón campana (`aria-label="Notificaciones"`, `data-testid="notificaciones_button"`), sin `onClick` ni `href`. Clic no hace nada hoy.

`DESIGN.md:293` ya lista el ícono de notificaciones (bell) como parte del set previsto — estaba planeado, nunca construido.

## Bloqueo — Regla Crítica #14 (UI Fidelity Contract)

No hay entrada en `.context/design/master-design-plan.md` §8 para esta pantalla. Antes de implementar:

(a) generar mockup vía `/design-system` (fase de mapeo de pantallas — genera brief portable, user lo lleva a Claude Design / Open Design), o
(b) ratificar build spec-only en §5 con aprobación explícita del user (+ ADR si hay decisión arquitectónica involucrada).

---

## Fields

### Clasificación

0|i000hr:

### customfield_10000

{repository={count=1, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":1,"lastUpdated":"2026-08-04T17:57:11.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":1,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
