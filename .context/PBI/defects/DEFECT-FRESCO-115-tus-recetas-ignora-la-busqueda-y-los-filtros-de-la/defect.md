# DEFECT: "Tus recetas" ignora la búsqueda y los filtros de la Biblioteca

**Jira Key:** [FRESCO-115](https://basiliomontescastano.atlassian.net/browse/FRESCO-115)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: `components/recipes/recipe-library.tsx`, sección `data-testid="personal*recipes*section"`.
- ***Pasos para reproducir***: en `/recipes`, escribir en el buscador algo que no matchee nada (ej. `zzzznomatchxyz123`).
- ***Esperado***: o bien la sección "Tus recetas" también se filtra por la búsqueda/filtros, o el mensaje de "No encontramos nada para tu búsqueda" deja claro que solo aplica al catálogo.
- ***Observado***: la receta propia ("Tortilla de mi abuela") sigue mostrándose completa arriba, mientras el estado vacío "No encontramos nada para tu búsqueda" aparece debajo — el usuario ve simultáneamente una receta visible y el mensaje de "no encontramos nada", lo cual es contradictorio a primera vista. Mismo comportamiento con cualquier combinación de filtros (tab de comida, cocina, dieta, alérgeno).
- ***Evidencia***: screenshot con búsqueda "zzzznomatchxyz123" — tarjeta "Tortilla de mi abuela" visible + panel "No encontramos nada para tu búsqueda" justo debajo.

## Por qué importa

El mensaje "no encontramos nada" contradice lo que el usuario ve en pantalla al mismo tiempo (su propia receta sigue visible), lo cual se lee como un bug de datos aunque el comportamiento subyacente sea consistente en todas las combinaciones de filtro.

## Alcance

Aplicar la búsqueda/filtros también a "Tus recetas", o aclarar en el mensaje de estado vacío que solo aplica al catálogo.

## Cómo reproducir

1. En `/recipes`, escribir en el buscador un texto que no matchee nada (ej. "zzzznomatchxyz123").
2. Observar que la sección "Tus recetas" sigue mostrando la receta propia mientras aparece el mensaje "No encontramos nada para tu búsqueda" debajo.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
