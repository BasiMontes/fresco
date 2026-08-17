# DEFECT: Datos de onboarding de una cuenta se filtran a otra vía sessionStorage compartido (no se limpia en login/signup/logout)

**Jira Key:** [FRESCO-150](https://basiliomontescastano.atlassian.net/browse/FRESCO-150)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `lib/store/onboarding-store.ts` — `persist` con `sessionStorage`, clave única `fresco-onboarding` no está scopeada por usuario/cuenta.
- El store solo se limpia (`reset()`) en un único punto: `app/onboarding/page.tsx` tras una generación de menú ***exitosa***. No se limpia al cerrar sesión, al crear una cuenta nueva, ni al fallar la generación.
- Reportado en vivo: usuario creó cuenta nueva (`basi_montes+test@hotmail.com`) en el mismo navegador/pestaña donde antes había completado (parcialmente) el onboarding con otra cuenta — el paso 1 ya traía "Nombre" y "Sexo" precargados de la sesión anterior.

## Por qué importa

Datos de una cuenta se filtran al formulario de otra cuenta distinta en el mismo navegador — confuso para el usuario y potencialmente vergonzoso si son cuentas de personas distintas compartiendo dispositivo/navegador (ej. hogar).

## Alcance

Limpiar `useOnboardingStore` (`reset()`) en los puntos donde cambia la identidad de la sesión: al hacer login, al hacer signup, y al cerrar sesión (`signOut`) — no solo tras generación exitosa.

## Cómo reproducir

1. Completar parcialmente el onboarding (paso 1: nombre + sexo) con la cuenta A, sin llegar a generar el menú.
2. Cerrar sesión o crear una cuenta nueva (cuenta B) en la misma pestaña/navegador.
3. Entrar a `/onboarding` con la cuenta B.
4. Observar que el paso 1 ya trae los datos de la cuenta A precargados.

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
