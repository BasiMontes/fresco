# DEFECT: Jerarquía visual recetas 'Últimas recetas añadidas'

**Jira Key:** [FRESCO-79](https://basiliomontescastano.atlassian.net/browse/FRESCO-79)
**Priority:** Medium
**Status:** Finalizada
**Components:** None

---

## Description

## Qué se observa

El título de sección "Últimas recetas añadidas" usa `text-h5` (15px, peso 400) — el mismo tamaño y peso que los títulos de las tarjetas de receta que tiene debajo (`RecipeCard` también renderiza su título en `text-h5`), y coincide además con `body-md` (texto normal), que también es 15px/400. Resultado: el encabezado de sección no se distingue visualmente ni de las tarjetas que agrupa ni del texto corriente de la página.

- `components/menu/latest-recipes-section.tsx:22-33`
- `components/recipe/recipe-card.tsx:93`

## Se espera

Encabezado de sección con jerarquía clara por encima de las tarjetas — por ejemplo subir a `text-h4`/`text-h3`, o diferenciar peso/color respecto al título de card.

## Nota adicional (revisar si corresponde a este ticket o aparte)

La grilla de esta sección llega a `lg:grid-cols-6` (tarjetas muy angostas), mientras la grilla de "recetas de hoy" en la misma página (`/menu`) usa `sm:grid-cols-3`. Inconsistencia de densidad entre dos usos de `RecipeCard` en la misma pantalla.

---

## Metadata

- **Created:** 8/4/2026
- **Updated:** 8/6/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
