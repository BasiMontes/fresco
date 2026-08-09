// Domain types for the `recipes` table.
//
// Shape source: schema_supabase.sql — the confirmed-LIVE, already-executed
// schema (~35 seeded rows), JSONB-flexible (meta/clasificacion/dieta/
// alergenos/ingredientes_* stored as jsonb columns). This is authoritative
// per architecture.md §4 — NOT fresco-schema-sql.md's typed-relational
// design, which was never executed for this table.

/**
 * Declared/recipe allergen vocabulary. Intentionally typed as `string`, not a
 * strict literal union: fresco-core-tecnico.md documents "los 14 [alérgenos]
 * de la normativa europea" but its own enumerated list only names 13 (it
 * omits "cacahuetes" / peanuts, one of the 14 official EU-regulated
 * allergens). Given FR-8.1/NFR-SEC-4's zero-tolerance allergen-safety
 * requirement, a strict union risked either silently excluding a real
 * allergen value or producing false compile-time narrowing on live data this
 * migration never independently verified. Flagged here for a human to
 * reconcile against the actual seeded `recipes.alergenos` values — not
 * silently "fixed" by guessing the missing entry's exact spelling/accent.
 */
export type Alergeno = string;

export type CosteEstimado = 'muy_bajo' | 'bajo' | 'medio' | 'alto';
export type DificultadReceta = 'muy_facil' | 'facil' | 'media' | 'avanzada';
export type Temporada = 'primavera' | 'verano' | 'otoño' | 'invierno' | 'todo_el_año';
export type TipoPlato = 'desayuno' | 'comida' | 'cena' | 'snack';
export type CategoriaReceta
  = | 'pasta' | 'arroz' | 'legumbres' | 'carne' | 'pescado' | 'verdura'
    | 'huevos' | 'sopa' | 'ensalada' | 'sandwich' | 'pizza' | 'guiso';
export type TipoCocina
  = | 'española' | 'italiana' | 'mexicana' | 'asiática'
    | 'mediterránea' | 'latina' | 'internacional';

export interface RecipeMeta {
  tiempo_prep_min: number
  tiempo_coccion_min: number
  tiempo_total_min: number
  raciones: number
  coste_estimado: CosteEstimado
  dificultad: DificultadReceta
}

export interface RecipeClasificacion {
  tipo_plato: TipoPlato
  categoria: CategoriaReceta
  cocina: TipoCocina
  es_contundente: boolean
  es_ligero: boolean
  es_comfort_food: boolean
  apto_tupper: boolean
  apto_congelar: boolean
}

export interface RecipeDieta {
  vegetariano: boolean
  vegano: boolean
  sin_gluten: boolean
  sin_lactosa: boolean
  sin_huevo: boolean
  bajo_fodmap: boolean
  keto: boolean
  paleo: boolean
  halal: boolean
  kosher: boolean
}

/**
 * Row shape of `public.recipes` as read from Supabase. jsonb columns are
 * typed as their conceptual shape (per fresco-core-tecnico.md §1) but may be
 * `null` for rows the batch-generation pipeline populated only partially —
 * every reader of this type must treat the jsonb fields as optional.
 */
export interface Recipe {
  id: string
  created_at: string
  updated_at: string
  nombre: string
  slug: string
  descripcion_corta: string | null
  /** Unsplash stock photo, matched by `nombre`/`descripcion_corta` — `null` until the recipe's backfill batch runs (FRESCO-31). */
  foto_url: string | null
  meta: RecipeMeta | null
  clasificacion: RecipeClasificacion | null
  dieta: RecipeDieta | null
  alergenos: Alergeno[] | null
  ingredientes_principales: string[] | null
  ingredientes_que_puede_desagradar: string[] | null
  temporada: Temporada[] | null
  pasos_resumen: string[] | null
  // aprendizaje columns (ADR-0001) — added by the additive ALTER migration
  // (supabase/migrations/20260725120000_add_aprendizaje_columns_to_recipes.sql),
  // not present in the originally-executed schema_supabase.sql.
  veces_cocinada: number
  veces_descartada: number
  rating_promedio: number | null
  ultima_vez_en_menu: string | null
}

/**
 * A personal recipe a user creates for their own library (FRESCO-68).
 * Deliberately NOT `Recipe` — that shape carries catalog-only fields
 * (`slug`, `meta`, `clasificacion`, `dieta`, `alergenos`, ...) a personal
 * recipe has no reason to hold, and this table is never read by
 * `get_filtered_recipes()` or the AI menu generator.
 */
export interface RecetaPropia {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  nombre: string
  ingredientes: string[]
  pasos: string[]
}
