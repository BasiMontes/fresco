# DEFECT: Recetas: placeholder de búsqueda se corta feo en mobile

**Jira Key:** [FRESCO-176](https://basiliomontescastano.atlassian.net/browse/FRESCO-176)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se pide

- ***Dónde***: `components/recipes/recipe-library.tsx` — el input de búsqueda (placeholder "Buscar receta, ingrediente...") comparte fila con el botón "Crear propia", siempre visible.
- Hallazgo del QA sweep (agente Recetas+Favoritos, MINOR): en mobile el placeholder se corta a mitad de palabra ("Buscar receta, ingı", sin elipsis) porque el input queda muy angosto.

## Cambio propuesto

- Evaluar: placeholder más corto en mobile, `text-overflow: ellipsis` en el input, o que "Crear propia" pase a una fila propia por debajo en mobile (`flex-wrap`).

## Alcance

- Solo el layout de esa fila en `recipe-library.tsx`.

---

## Metadata

- **Created:** 8/10/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
