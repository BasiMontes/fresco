# DEFECT: Receta propia con nombre vacío en producción — sin CHECK constraint en DB

**Jira Key:** [FRESCO-124](https://basiliomontescastano.atlassian.net/browse/FRESCO-124)
**Related Story:** [FRESCO-118](https://basiliomontescastano.atlassian.net/browse/FRESCO-118) - Botón "Guardar receta" no se deshabilita con nombre vacío
**Priority:** Medium
**Status:** Rechazos
**Components:** None

---

## Description

Qué se observa

Dónde: tabla recetas_propias (Supabase), formulario de creación en components/recipes/create-recipe-form.tsx (validación client-side de FRESCO-118)

Pasos para reproducir:
1. Consultar recetas_propias donde nombre esté vacío o sea solo espacios.

Esperado: no debería existir ninguna fila con nombre vacío — FRESCO-118 bloquea el botón "Guardar receta" en el cliente cuando el nombre está vacío/es solo espacios.

Observado: existe en producción una fila real (id df4e3573-d16d-48b4-be38-a1e2b2bf9648) con nombre completamente vacío y cero contenido — su card muestra "0 ingredientes" y su detalle renderiza un <h1> vacío. Se confirmó en vivo que la UI (formulario "Crear propia") SÍ bloquea correctamente el guardado con nombre vacío/solo-espacios (FRESCO-118 sigue funcionando desde el cliente) — esta fila solo pudo haberse creado saltándose el cliente (escritura directa a la API/DB), lo que prueba que no existe ningún constraint server-side/DB respaldando la regla.

Evidencia: fila real en recetas_propias; components/recipes/create-recipe-form.tsx (disabled={!isValid || isSaving}, solo client-side).

Por qué importa

FRESCO-118 es una validación de UX, no una garantía de integridad de datos — cualquier llamada directa a la API REST de Supabase (que el proyecto expone vía RLS a usuarios autenticados) puede crear registros inválidos que luego rompen la UI (card/detalle vacíos). Es un gap de integridad de datos, no solo un bug de UI.

Alcance

1. Añadir un CHECK constraint en Postgres: CHECK (length(trim(nombre)) > 0) sobre recetas_propias.nombre.
2. Limpiar (o marcar para revisión) la fila huérfana existente.

Cómo reproducir

Ver Pasos para reproducir arriba — query directa a la tabla es suficiente para confirmar el estado actual.


---

## Related Issues

- relates to: [FRESCO-64](https://basiliomontescastano.atlassian.net/browse/FRESCO-64) - Biblioteca de Recetas
- relates to: [FRESCO-118](https://basiliomontescastano.atlassian.net/browse/FRESCO-118) - Botón "Guardar receta" no se deshabilita con nombre vacío

---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/27/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** major, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
