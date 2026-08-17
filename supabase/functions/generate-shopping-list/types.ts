import type {
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
} from '../../../api/schemas/api-contracts.types.ts'
import type { DiaSemana } from '../../../api/schemas/meal-plan.types.ts'
import type { ShoppingListPasillo } from '../../../api/schemas/shopping-list.types.ts'

export type { GenerateShoppingListRequest, GenerateShoppingListResponse, ShoppingListPasillo }

/** Ingredient before consolidation — one entry per ingredient per recipe slot. */
export interface RawIngrediente {
  nombre: string
  receta_id: string
  raciones_receta: number // base servings the recipe's ingredient quantities assume
  raciones_usuario: number // household size, from user_profiles.num_personas
  // FRESCO-212: dish + day provenance, carried through consolidation so the
  // UI can show "used for X, on Y" per ingredient row.
  receta_nombre: string
  dia: DiaSemana
}

/** Ingredient after summing + deduplicating across all 21 slots. */
export interface IngredienteConsolidado {
  nombre: string
  cantidad: number
  unidad: string
  // FRESCO-212: every distinct (recipe, day) this ingredient was pulled
  // from, deduplicated — a staple like "cebolla" can list several.
  usos: { receta: string; dia: DiaSemana }[]
}

/** Row shape of the `meal_plan_recipes -> recipes` join used in index.ts step 6. */
export interface SlotWithRecipeRow {
  /** `null` for an FR-8.2 / AC Scenario 4 (FRESCO-23) unsafe-slot row — the `!recipe` check below already skips it. */
  recipe_id: string | null
  // FRESCO-212: the day this slot occupies — needed to show ingredient provenance.
  dia: DiaSemana
  recipes: {
    id: string
    nombre: string
    meta: { raciones?: number } | null
    ingredientes_principales: string[] | null
  } | null
}
