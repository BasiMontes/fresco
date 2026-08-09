// Shared taxonomy constants for the Food.com recipe migration (FRESCO-138).
// Mirrors the literal unions in `api/schemas/recipe.types.ts`. Duplicated
// here (not imported) because those are compile-time-only types — runtime
// validation (Stage 2's Gemini output, the RecipeDataContract suite) needs
// real arrays to check against, not types. Keep in sync by hand if the
// source types change; a mismatch fails LOUD (every check rejects with a
// visible reason), not silently.
export const TIPO_PLATO = ['desayuno', 'comida', 'cena', 'snack'] as const;
export const CATEGORIA_RECETA = ['pasta', 'arroz', 'legumbres', 'carne', 'pescado', 'verdura', 'huevos', 'sopa', 'ensalada', 'sandwich', 'pizza', 'guiso'] as const;
export const TIPO_COCINA = ['española', 'italiana', 'mexicana', 'asiática', 'mediterránea', 'latina', 'internacional'] as const;
export const COSTE_ESTIMADO = ['muy_bajo', 'bajo', 'medio', 'alto'] as const;
export const DIFICULTAD_RECETA = ['muy_facil', 'facil', 'media', 'avanzada'] as const;
export const TEMPORADA = ['primavera', 'verano', 'otoño', 'invierno', 'todo_el_año'] as const;

// Confirmed live-matching (unlike categoria/cocina — see git history for
// that finding) via
// `select distinct jsonb_object_keys(dieta) from recipes where dieta is not null`.
export const DIETA_KEYS = [
  'vegetariano',
  'vegano',
  'sin_gluten',
  'sin_lactosa',
  'sin_huevo',
  'bajo_fodmap',
  'keto',
  'paleo',
  'halal',
  'kosher',
] as const;

// Live vocabulary, not the disputed doc list — queried 2026-08-09 via
// `select distinct jsonb_array_elements_text(alergenos) from recipes`.
export const ALERGENOS_VOCAB = [
  'apio',
  'cacahuetes',
  'crustaceos',
  'frutos_de_cascara',
  'frutos_secos',
  'gluten',
  'huevo',
  'lactosa',
  'moluscos',
  'pescado',
  'sesamo',
  'soja',
  'sulfitos',
] as const;
