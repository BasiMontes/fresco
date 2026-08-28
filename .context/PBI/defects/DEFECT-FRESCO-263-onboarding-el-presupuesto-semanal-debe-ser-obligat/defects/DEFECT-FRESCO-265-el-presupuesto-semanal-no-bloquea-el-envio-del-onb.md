# DEFECT: El presupuesto semanal no bloquea el envío del onboarding aunque esté vacío (regresión FRESCO-263)

**Jira Key:** [FRESCO-265](https://basiliomontescastano.atlassian.net/browse/FRESCO-265)
**Related Story:** [FRESCO-263](https://basiliomontescastano.atlassian.net/browse/FRESCO-263) - Onboarding: el presupuesto semanal debe ser obligatorio
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Contexto

Regresión encontrada durante el mismo QA exploratorio, en `/onboarding` paso 4 ("¿Quiénes cocináis en casa?"), campo "Presupuesto semanal (estimado)". FRESCO-263 (mergeada a main, PR #133) debía hacer este campo obligatorio.

## Pasos para reproducir

1. Completar el registro y llegar al paso 4 del onboarding en producción (`fresco-pro.vercel.app/onboarding`).
2. Dejar vacío el campo "Presupuesto semanal (estimado)".
3. Pulsar "Generar mi menú".

## Resultado

El menú se genera igualmente, sin bloquear el envío ni mostrar error de validación.

## Efecto secundario detectado

El dashboard (`/menu`) muestra una estimación de "~45€ gasto semanal", mientras que la lista de la compra generada a partir del mismo menú (`/shopping-list`) calcula 64,08–86,69€. Sin presupuesto real, el estimado mostrado en el dashboard no es fiable.

---

## Related Issues

- relates to: [FRESCO-263](https://basiliomontescastano.atlassian.net/browse/FRESCO-263) - Onboarding: el presupuesto semanal debe ser obligatorio

---

## Metadata

- **Created:** 8/25/2026
- **Updated:** 8/26/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** qa-exploratorio, regresion

---

_Synced from Jira by sync-jira-issues_
