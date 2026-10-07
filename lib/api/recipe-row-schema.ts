import type {
  Recipe,
  RecipeClasificacion,
  RecipeDieta,
  RecipeMeta,
  ShoppingListPasillo,
  Temporada,
} from '@schemas';
import { z } from 'zod';

/**
 * Runtime validation for the jsonb columns of `public.recipes` and
 * `public.shopping_lists.items` (FRESCO-820, audit-6 A6-A11). `lib/supabase/types.ts`
 * types those columns as `Json`, so the shape the UI relies on was only ever
 * asserted with a double type cast. Each schema is pinned to its domain type with
 * `satisfies z.ZodType<...>`: a change on either side stops compiling instead
 * of reaching the UI.
 */

const recipeMetaSchema = z.object({
  tiempo_prep_min: z.number(),
  tiempo_coccion_min: z.number(),
  tiempo_total_min: z.number(),
  raciones: z.number(),
  coste_estimado: z.enum(['muy_bajo', 'bajo', 'medio', 'alto']),
  dificultad: z.enum(['muy_facil', 'facil', 'media', 'avanzada']),
}) satisfies z.ZodType<RecipeMeta>;

const recipeClasificacionSchema = z.object({
  tipo_plato: z.enum(['desayuno', 'comida', 'cena', 'snack']),
  categoria: z.string(),
  cocina: z.string(),
  es_contundente: z.boolean(),
  es_ligero: z.boolean(),
  es_comfort_food: z.boolean(),
  apto_tupper: z.boolean(),
  apto_congelar: z.boolean(),
}) satisfies z.ZodType<RecipeClasificacion>;

const recipeDietaSchema = z.object({
  vegetariano: z.boolean(),
  vegano: z.boolean(),
  sin_gluten: z.boolean(),
  sin_lactosa: z.boolean(),
  sin_huevo: z.boolean(),
  bajo_fodmap: z.boolean(),
  keto: z.boolean(),
  paleo: z.boolean(),
  halal: z.boolean(),
  kosher: z.boolean(),
}) satisfies z.ZodType<RecipeDieta>;

const temporadaSchema = z.enum([
  'primavera',
  'verano',
  'otono',
  'invierno',
  'todo_el_ano',
]) satisfies z.ZodType<Temporada>;

const stringListSchema = z.array(z.string());

/** The eight jsonb columns of `recipes`, each nullable like its `Recipe` field. */
export const recipeJsonbSchema = z.object({
  meta: recipeMetaSchema.nullable(),
  clasificacion: recipeClasificacionSchema.nullable(),
  dieta: recipeDietaSchema.nullable(),
  alergenos: stringListSchema.nullable(),
  ingredientes_principales: stringListSchema.nullable(),
  ingredientes_que_puede_desagradar: stringListSchema.nullable(),
  temporada: z.array(temporadaSchema).nullable(),
  pasos_resumen: stringListSchema.nullable(),
}) satisfies z.ZodType<Pick<
  Recipe,
  | 'meta'
  | 'clasificacion'
  | 'dieta'
  | 'alergenos'
  | 'ingredientes_principales'
  | 'ingredientes_que_puede_desagradar'
  | 'temporada'
  | 'pasos_resumen'
>>;

const shoppingListItemSchema = z.object({
  nombre: z.string(),
  cantidad: z.number(),
  unidad: z.string(),
  comprado: z.boolean(),
  precio_estimado: z.number().optional(),
  usos: z.array(z.object({
    receta: z.string(),
    dia: z.enum(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']),
  })).optional(),
});

/** `shopping_lists.items`: the aisle-grouped list written only by `generate-shopping-list`. */
export const shoppingListPasillosSchema = z.array(z.object({
  nombre: z.string(),
  orden: z.number(),
  items: z.array(shoppingListItemSchema),
})) satisfies z.ZodType<ShoppingListPasillo[]>;
