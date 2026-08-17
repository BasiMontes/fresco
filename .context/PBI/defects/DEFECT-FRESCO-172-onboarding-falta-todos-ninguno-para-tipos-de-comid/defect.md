# DEFECT: Onboarding: falta Todos/Ninguno para tipos de comida

**Jira Key:** [FRESCO-172](https://basiliomontescastano.atlassian.net/browse/FRESCO-172)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `app/onboarding/page.tsx` — el par Todos/Ninguno (`select*all*days*button`/`select*no*days*button`, líneas ~620-625) solo existe para días. Comidas (`toggleMeal`, línea ~593) se deselecciona botón por botón, sin atajo masivo.
- Hallazgo del QA sweep (agente Onboarding+Menú, MAJOR): al no haber "Ninguno" para comidas, un user que deselecciona las 3 una por una no tiene ninguna señal de que está por dejar el estado en un caso límite no validado (ver FRESCO-165/166).

## Cambio propuesto

- Agregar el mismo par "Todos"/"Ninguno" para el bloque "¿Qué comidas quieres planificar?", mismo patrón visual y de testid que el de días.

## Alcance

- Solo el paso 4 de `app/onboarding/page.tsx`. Depende de FRESCO-165 (la validación de selección vacía) para que "Ninguno" en comidas no reintroduzca el mismo bug.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
