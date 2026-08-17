# Tarea: Auditar fotos aplicadas al catálogo de recetas (mismatches foto↔receta)

**Jira Key:** [FRESCO-192](https://basiliomontescastano.atlassian.net/browse/FRESCO-192)
**Status:** WIP
**Type:** Tarea

---

## Description

## Qué

Revisar minuciosamente las ~816 fotos ya aplicadas a `recipes.foto_url` (backfill FRESCO-31) para detectar mismatches entre la foto y la receta real.

## Por qué

El fallback de query amplia (v10, ver historial en `scripts/fetch-recipe-photos.ts`) sacrificó precisión por cobertura a partir de ~735/1000 aplicadas — decisión explícita del user en su momento ("de todas formas voy a lanzar agentes después a pulir fotos que no correspondan con la realidad"). Ahora toca esa revisión.

## Alcance

- Recorrer `recipes` con `foto*url is not null`, comparar cada foto contra `nombre`/`descripcion*corta`/`categoria` de la receta.
- Marcar/listar las que no correspondan (plato equivocado, ingrediente crudo en vez de cocinado, foto genérica sin relación).
- Para cada mismatch: re-buscar una foto mejor (mismo script/pipeline) o dejar sin foto si no hay match razonable en Unsplash.
- Fotos con tag `[broad]` en el log de aplicación son las de mayor riesgo — priorizar esas primero si hace falta trabajar por tandas.

## Nota

Depende de/relacionado con FRESCO-31 (backfill). Se linkea como "relates to".

---

## Fields

### Clasificación

0|i00187:

### customfield_10000

{}

---

## Metadata

- **Created:** 8/13/2026
- **Updated:** 8/13/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes

---

_Synced from Jira by sync-jira-issues_
