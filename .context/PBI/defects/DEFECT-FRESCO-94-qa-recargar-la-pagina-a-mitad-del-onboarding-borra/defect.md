# DEFECT: Recargar la página a mitad del onboarding borra todo el progreso sin avisar

**Jira Key:** [FRESCO-94](https://basiliomontescastano.atlassian.net/browse/FRESCO-94)
**Priority:** High
**Status:** Listo
**Components:** None

---

## Description

## Dónde

`app/onboarding/page.tsx` + `lib/store/onboarding-store.ts` (estado en memoria, zustand sin `persist`).

## Pasos para reproducir

1. En `/onboarding` paso 1, marcar varias dietas/alérgenos/ingredientes.
2. Recargar la página (F5).
3. Revisar el estado de los chips y el paso actual.

## Esperado

Alguna persistencia mínima (sessionStorage) o al menos una advertencia antes de perder la selección — es un formulario corto pero el usuario ya invirtió tiempo eligiéndolo.

## Observado

Confirmado con eval directo — tras seleccionar TODAS las opciones del paso 1 (7 dietas + 6 alérgenos + 14 ingredientes) y recargar, las 7 dietas vuelven a `aria-pressed="false"` y el wizard no conserva nada; no hay `persist` de zustand ni sessionStorage de por medio.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** qa-sweep, severity-mayor

---

_Synced from Jira by sync-jira-issues_
