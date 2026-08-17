# DEFECT: /recipes: filtros de cocina/dieta/alérgeno son <select> nativos sin jerarquía visual

**Jira Key:** [FRESCO-160](https://basiliomontescastano.atlassian.net/browse/FRESCO-160)
**Priority:** Medium
**Status:** Control de calidad
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/recipes/recipe-library.tsx` — filtros de cocina, dieta y alérgeno en `/recipes` (`FilterSelect`, líneas ~33-50, envuelve un `<select>` nativo del navegador; renderizado en `flex flex-wrap gap-2` sin labels visibles, líneas ~178-199).
- Hallazgo directo del user: los 3 filtros no tienen jerarquía visual (compiten igual entre sí, sin distinguirse), y son controles nativos del navegador (`<select>`), no del design system.

## Cambio propuesto

- Reemplazar `FilterSelect` (`<select>` nativo) por el componente `Dropdown` ya existente en `components/ui/dropdown.tsx` (listbox custom, accesible, usado en onboarding — mismo patrón `pill`/`bg-surface` del resto de la app).
- Agregar label visible arriba de cada dropdown (hoy solo tienen `aria-label`, invisible) y agrupar los 3 bajo un heading tipo "Filtros" (mismo patrón `text-h6 uppercase text-tertiary` que ya usa la sección "Tus recetas" en el mismo archivo) para separarlos visualmente del `SegmentedControl` de comida.

## Alcance

- Solo `recipe-library.tsx`. No toca `Dropdown` (`components/ui/dropdown.tsx`) — se consume tal cual existe. No cambia la lógica de filtrado (`matchesCocina`/`matchesDieta`/`matchesAlergenoFilter`), solo el control de UI y su presentación.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/10/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
