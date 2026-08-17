# DEFECT: Onboarding: 'Ninguno' en días/comidas no bloquea 'Generar mi menú'

**Jira Key:** [FRESCO-165](https://basiliomontescastano.atlassian.net/browse/FRESCO-165)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/onboarding/page.tsx` línea ~702 — el botón "Generar mi menú" solo deshabilita por `isGenerating || !household.valid || !presupuestoValid`. No chequea `planningDays.length === 0` ni `planningMeals.length === 0`.
- Hallazgo del QA sweep (agente Onboarding+Menú, BLOCKER): tocar "Ninguno" en días dejaba 0 días seleccionados y el botón seguía habilitado — generaba un menú igual.

## Cambio propuesto

- Agregar `planningDays.length === 0 || planningMeals.length === 0` a la condición de `disabled` del botón, más un mensaje de validación visible (mismo patrón que `household*validation*message`/`presupuesto*validation*message` ya existentes en el archivo).

## Alcance

- Solo el paso 4 de `app/onboarding/page.tsx`. Relacionado con FRESCO-166 (mismo archivo, root cause compartido: esta validación también evita el repro de ese ticket).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
