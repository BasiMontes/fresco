# DEFECT: /calendar: quitar repetición de Desayuno/Comida/Cena por tarjeta y drag handle en desayuno

**Jira Key:** [FRESCO-159](https://basiliomontescastano.atlassian.net/browse/FRESCO-159)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/calendar/calendar-grid.tsx`, `SlotCell` — cada tarjeta de comida en `/calendar` (línea ~425: `<p className="mb-2 text-h6 uppercase text-tertiary">{tipo}</p>`) y el botón de drag & drop (línea ~454-470, `GripVertical`, renderizado para cualquier `tipo` con receta).
- Hallazgo directo del user: la palabra "Desayuno"/"Comida"/"Cena" se repite en cada tarjeta (7 días × 3 filas, siempre las mismas 3 palabras) — es redundante. Además, el desayuno no debería tener el icono de drag & drop.

## Cambio propuesto

- Evaluar sacar el label `{tipo}` de cada tarjeta individual y mostrarlo una sola vez por fila (a nivel de la fila Desayuno/Comida/Cena, no repetido en cada columna de día) — o, si se mantiene por tarjeta, evaluar con el user si de verdad hace falta.
- Ocultar el botón de drag handle (`GripVertical`) cuando `tipo === 'desayuno'` — el desayuno deja de ser arrastrable.

## Alcance

- Solo `SlotCell` en `calendar-grid.tsx`. El guard existente `from.tipo !== to.tipo` (swap solo entre incluye mismo tipo) queda igual; para desayuno el swap por drag deja de estar disponible por completo (sin drag handle, no hay drag que iniciar).

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
