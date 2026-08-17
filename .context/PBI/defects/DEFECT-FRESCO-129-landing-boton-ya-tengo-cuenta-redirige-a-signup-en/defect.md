# DEFECT: Landing: botón "Ya tengo cuenta" redirige a /signup en vez de /login

**Jira Key:** [FRESCO-129](https://basiliomontescastano.atlassian.net/browse/FRESCO-129)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Descripción

En la landing, el botón "Ya tengo cuenta" redirige a `/signup` en lugar de `/login`.

## Dónde

`components/landing/site-nav.tsx:44`

## Comportamiento esperado

El botón debe enlazar a `/login` (ruta de inicio de sesión existente en `app/login/`).

## Comportamiento actual

Enlaza a `/signup`, la misma ruta que "Empezar gratis" / guardar menú.

## Impacto

Usuario que ya tiene cuenta cae en flujo de registro en vez de login. Confusión alta, punto de entrada crítico.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
