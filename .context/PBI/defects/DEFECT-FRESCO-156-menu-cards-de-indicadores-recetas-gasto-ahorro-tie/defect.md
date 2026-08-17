# DEFECT: /menu: cards de indicadores (recetas, gasto, ahorro, tiempo) amontonados en 4 filas — evaluar grid 2x2

**Jira Key:** [FRESCO-156](https://basiliomontescastano.atlassian.net/browse/FRESCO-156)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `/menu` — `components/menu/available-recipes-card.tsx` (1 card) + `components/menu/savings-estimate-cards.tsx` (3 cards: gasto semanal, ahorro, tiempo recuperado).
- Hallazgo directo del user: los 4 componentes (recetas disponibles, gasto semanal, ahorro, tiempo recuperado) se amontonan verticalmente en mobile — cada uno usa `grid-cols-1` por debajo de `sm`, así que hoy son 4 filas apiladas. El user propone evaluar 2 columnas × 2 filas en vez de 4 filas.

## Cambio propuesto

- Evaluar una grilla `grid-cols-2` en mobile que agrupe los 4 indicadores (recetas disponibles + los 3 de `SavingsEstimateCards`) en 2×2, en vez de las 4 filas actuales. Puede requerir unificar ambos componentes bajo un mismo contenedor de grid, o al menos alinear sus breakpoints.

## Alcance

- Solo el layout de estos 4 cards en `/menu`. No cambia los valores mostrados (FRESCO-58's estimados fijos) ni la lógica de conteo de `AvailableRecipesCard`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
