# EPIC: Migración de recetas: dataset Food.com (Kaggle)

**Jira Key:** [FRESCO-138](https://basiliomontescastano.atlassian.net/browse/FRESCO-138)
**Priority:** Medium
**Status:** Rechazos
**Total Story Points:** 0

---

## Description

## Descripción

Migración aditiva del catálogo de recetas: suma ~1000 recetas derivadas del dataset ***Food.com Recipes and Reviews*** (Kaggle, publicado por Irkaal, CC0 declarado por el publisher) a las ~1000 recetas actuales generadas por IA. Coexistencia, no reemplazo — `meal*plan*recipes.recipe_id` tiene `ON DELETE RESTRICT` y hay 65 planes de menú reales enganchados al catálogo actual.

Traducción español + mapeo a la taxonomía existente vía Gemini antes de insertar. Imágenes: se reutiliza el pipeline Unsplash ya existente (FRESCO-31), no las URLs de imagen de Food.com — evita la principal ambigüedad legal de ownership por-foto.

## Documentos

- Spec: `docs/superpowers/specs/2026-08-09-foodcom-recipe-dataset-migration-design.md`
- Plan: `tasks/plan.md`
- Todo: `tasks/todo.md`

## Alcance

9 historias hijas cubren: schema, tipos, scaffolding de datos, pipeline en 2 etapas (curación sin IA + traducción/mapeo con IA), suite de calidad de datos, documentación de procedencia (`DATA_SOURCES.md`), y ejecución real del pipeline en batches (mismo patrón que el backfill de fotos, FRESCO-31, 36 batches).

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/9/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
