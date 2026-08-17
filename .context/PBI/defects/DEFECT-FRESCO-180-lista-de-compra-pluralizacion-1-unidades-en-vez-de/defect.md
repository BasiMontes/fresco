# DEFECT: Lista de compra: pluralización '1 unidades' en vez de '1 unidad'

**Jira Key:** [FRESCO-180](https://basiliomontescastano.atlassian.net/browse/FRESCO-180)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: la lista de la compra generada muestra "1 unidades" en vez de "1 unidad" para items con cantidad 1 y unidad "unidades" (aguacate, lima, limón, melón, pimiento en el ejemplo del QA sweep).
- Hallazgo del QA sweep (agente Lista+Perfil, MINOR): bug de gramática en español, probablemente originado en el texto que devuelve la Edge Function `generate-shopping-list` (clasificación vía Gemini), no en el formateo del cliente (`components/shopping-list/shopping-list-view.tsx` solo concatena `{item.cantidad} {item.unidad}` tal cual llega).

## Cambio propuesto

- Investigar si conviene normalizar la pluralización en el cliente (`shopping-list-view.tsx`, singularizar "unidades"→"unidad" cuando `cantidad === 1`) o corregir el prompt/post-procesamiento de la Edge Function. El fix en cliente es más simple y no requiere tocar la función ya desplegada.

## Alcance

- Probablemente solo `components/shopping-list/shopping-list-view.tsx` si se resuelve en cliente.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
