# DEFECT: Onboarding: fallo de generación deja el perfil desincronizado del plan real

**Jira Key:** [FRESCO-166](https://basiliomontescastano.atlassian.net/browse/FRESCO-166)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/onboarding/page.tsx`, `handleGenerate()` líneas ~200-247 — `upsertUserProfile()` (guarda `planning*meals`/`planning*days`) se llama y persiste ANTES de `generateMealPlan()`. Si la generación falla (ej. 409 "ya existe menú esta semana"), el perfil ya quedó guardado con la selección inválida/vacía.
- Hallazgo del QA sweep (agente Onboarding+Menú, BLOCKER): al deseleccionar las 3 comidas y fallar la generación con 409, `/menu` quedó con la sección "Menú de hoy por comida" completamente vacía (sin ninguna tarjeta), sin ningún error visible — porque `/menu` filtra las comidas de hoy por la preferencia del perfil (ya corrompida), no por lo que realmente existe en el plan guardado.

## Cambio propuesto

- Fix inmediato: FRESCO-165 (validación de selección vacía) ya bloquea el repro exacto reportado. Pendiente evaluar el problema de fondo, más amplio: `upsertUserProfile()` y `generateMealPlan()` no son atómicos — cualquier fallo de `generateMealPlan()` (no solo el caso de selección vacía) deja el perfil desincronizado del plan real. Solución de fondo (no incluida en este fix inmediato, marcar como seguimiento): reordenar las llamadas, o hacer que `/menu` derive qué comidas mostrar del plan realmente persistido en vez de la preferencia de perfil.

## Alcance

- Fix inmediato: ninguno adicional, cubierto por FRESCO-165. Este ticket documenta el hallazgo completo y el riesgo residual (perfil-plan no atómico) para seguimiento futuro.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
