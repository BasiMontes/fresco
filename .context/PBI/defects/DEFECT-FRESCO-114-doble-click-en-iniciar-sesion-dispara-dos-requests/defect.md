# DEFECT: Doble-click en "Iniciar sesión" dispara dos requests de autenticación

**Jira Key:** [FRESCO-114](https://basiliomontescastano.atlassian.net/browse/FRESCO-114)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `/login`, botón `login*submit*button` (mismo patrón en signup/forgot-password/update-password — todos usan `disabled={isSubmitting}` sin debounce ni guard adicional)
- ***Pasos para reproducir***: en `/login`, completar email/password válidos, disparar dos clicks sincrónicos sobre el botón submit (sin esperar re-render entre ambos).
- ***Esperado***: solo 1 request POST a `/auth/v1/token`.
- ***Observado***: se registraron 2 requests POST idénticos a `auth/v1/token?grant_type=password` en la pestaña de network. El guard `disabled={isSubmitting}` depende de un re-render de React que no llega a tiempo si los dos clicks ocurren en el mismo tick de JS.
- ***Evidencia***: `playwright-cli requests` mostró 2 llamadas POST consecutivas tras el doble-click programático.

## Por qué importa

En el peor caso, consume cupo de rate-limit de Supabase Auth más rápido de lo necesario, y en un doble-click humano real muy rápido podría disparar dos intentos de login simultáneos. No rompe el flujo funcional en sí — Supabase maneja bien el segundo request duplicado.

## Alcance

Mismo patrón afecta signup/forgot-password/update-password (todos usan `disabled={isSubmitting}` sin guard adicional) — agregar un guard síncrono (ej. flag en un ref) además del `disabled` basado en estado, para no depender del re-render de React.

## Cómo reproducir

1. En `/login`, completar email/password válidos.
2. Disparar dos clicks sincrónicos sobre el botón "Iniciar sesión" (sin esperar re-render entre ambos).
3. Revisar la pestaña de network: se registran 2 requests POST a `/auth/v1/token?grant_type=password`.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
