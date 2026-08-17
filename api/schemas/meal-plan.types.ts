import type { TipoPlato } from './recipe.types.ts';

// Row shapes of `public.meal_plans` and `public.meal_plan_recipes`
// (fresco-schema-sql.md Blocks 4-5), the other two newly-migrated tables.

export type DiaSemana
  = | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

/** FRESCO-199: 'excluida' marks a slot the user's own `planning_selection` left out (not a system gap). */
export type EstadoRecetaMenu = 'pendiente' | 'cocinada' | 'descartada' | 'sustituida' | 'excluida';

export interface MealPlan {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  semana_iso: string
  fecha_inicio: string
  advertencias: string[]
  completado: boolean
}

/** One slot (day x meal-type) within a plan. 21 rows per meal_plan. */
export interface MealPlanRecipe {
  id: string
  created_at: string
  updated_at: string
  meal_plan_id: string
  /** `null` when the model reported no safe recipe for this slot (FR-8.2 / AC Scenario 4, FRESCO-23). */
  recipe_id: string | null
  dia: DiaSemana
  tipo_plato: TipoPlato
  estado: EstadoRecetaMenu
  rating: number | null
}
