# Spec Compliance Matrix — FRESCO-68

| AC scenario (Gherkin) | covered_by | evidence | status |
| --- | --- | --- | --- |
| Crear una receta propia | manual:live-ui | Formulario completo → aparece en "Tus recetas" al instante, confirmado también en DB (`select * from recetas_propias`) | covered |
| Receta propia no participa en la generación | code-review | `get_filtered_recipes()` y `generate-meal-plan` sólo referencian `public.recipes`, nunca `public.recetas_propias` — garantía estructural, no probada con un ciclo de generación real | covered |
| Campos obligatorios | manual:live-ui | Click "Guardar receta" con nombre vacío → mensaje inline, no guarda, diálogo se mantiene abierto | covered |
