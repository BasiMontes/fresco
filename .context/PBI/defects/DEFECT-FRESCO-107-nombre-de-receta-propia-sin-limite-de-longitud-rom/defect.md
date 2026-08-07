# DEFECT: Nombre de receta propia sin límite de longitud rompe el layout de la grilla "Tus recetas"

**Jira Key:** [FRESCO-107](https://basiliomontescastano.atlassian.net/browse/FRESCO-107)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

## Qué se observa

- ***Dónde***: Formulario "Crear propia" (`components/recipes/create-recipe-form.tsx`, input `receta*nombre*input`) → se refleja en `components/recipes/personal-recipe-card.tsx` dentro de la sección "Tus recetas" (`data-testid="personal*recipes*section"`).
- La tarjeta crece a ~30 líneas de alto, muchísimo más que sus vecinas, distorsionando toda la grilla "Tus recetas" (las demás tarjetas quedan visualmente desalineadas y empujadas).
- No hay `maxLength` en el `<input>`.
- No hay constraint de longitud en `recetas*propias.nombre` (solo `check (char*length(trim(nombre)) > 0)`, sin tope).
- `PersonalRecipeCard`'s `<h3>` no tiene `truncate`/`line-clamp`.
- ***Evidencia***: Screenshot en 1280px y en 375px — en ambos la tarjeta larga domina visualmente la pantalla y empuja el resto del contenido.

## Por qué importa

Un nombre de longitud arbitraria rompe el layout completo de la grilla "Tus recetas" para cualquier usuaria que la vea, no solo para quien creó la receta con nombre extremadamente largo — el problema es visible y persistente en toda la sección.

## Alcance

Agregar `maxLength` razonable al input del formulario (`components/recipes/create-recipe-form.tsx`), y/o `truncate`/`line-clamp` en `personal-recipe-card.tsx` como defensa en la capa de presentación, independientemente del límite de input.

## Cómo reproducir

1. En `/recipes`, click "Crear propia".
2. En "Nombre" pegar un texto de ~1000 caracteres (ej. "Tortilla " repetido 120 veces).
3. Dejar ingredientes/pasos vacíos (no es necesario llenarlos) y click "Guardar receta".
4. Observar la sección "Tus recetas": la tarjeta nueva crece a ~30 líneas de alto y distorsiona toda la grilla.

---

## Metadata

- **Created:** 8/6/2026
- **Updated:** 8/7/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
