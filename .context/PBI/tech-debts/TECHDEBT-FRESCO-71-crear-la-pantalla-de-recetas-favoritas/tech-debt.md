# Tarea: Crear la pantalla de recetas favoritas

**Jira Key:** [FRESCO-71](https://basiliomontescastano.atlassian.net/browse/FRESCO-71)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Confirmado: la pantalla no existe

No hay `app/favorites` (ni ruta similar) en el repo. Ningún componente relacionado.

## Entry point muerto ya existente

`app/(app)/menu/page.tsx:114-116` — botón corazón (`aria-label="Favoritos"`, `data-testid="favoritos_button"`), sin `onClick` ni `href`. Clic no hace nada hoy.

## Acoplado con FRESCO-77

No existe capa de persistencia de favoritos en absoluto (ver FRESCO-77) — esta pantalla no puede construirse sin resolver antes (o junto con) el backend que falta ahí: tabla + RLS + API/RPC de toggle.

## Bloqueo — Regla Crítica #14 (UI Fidelity Contract)

Mismo gate que FRESCO-72: no hay entrada en `.context/design/master-design-plan.md` §8 para esta pantalla. Necesita mockup o ratificación spec-only antes de construir.

## Alcance recomendado

Trabajar después de (o junto con) FRESCO-77 — construir la pantalla antes que el backend deja el botón favoritos sin datos que mostrar.

---

## Fields

### Clasificación

0|i000hj:

### customfield_10000

{repository={count=4, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":4,"lastUpdated":"2026-08-05T18:22:32.000+0200","dataType":"repository"},"byInstanceType":{"GitHub":{"count":4,"name":"GitHub"},"oAuth-com.github.integration.production":{"count":4,"name":"GitHub"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/5/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
