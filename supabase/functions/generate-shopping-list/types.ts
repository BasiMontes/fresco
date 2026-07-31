import type {
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
} from '../../../api/schemas/api-contracts.types.ts'
import type { ShoppingListPasillo } from '../../../api/schemas/shopping-list.types.ts'

export type { GenerateShoppingListRequest, GenerateShoppingListResponse, ShoppingListPasillo }

/** Ingredient before consolidation — one entry per ingredient per recipe slot. */
export interface RawIngrediente {
  nombre: string
  receta_id: string
  raciones_receta: number // base servings the recipe's ingredient quantities assume
  raciones_usuario: number // household size, from user_profiles.num_personas
}

/** Ingredient after summing + deduplicating across all 21 slots. */
export interface IngredienteConsolidado {
  nombre: string
  cantidad: number
  unidad: string
}

/** The exact JSON shape Gemini must return — see api-contracts.md §2b. */
export interface ShoppingListModelOutput {
  pasillos: ShoppingListPasillo[]
  resumen: GenerateShoppingListResponse['resumen']
}

/** Row shape of the `meal_plan_recipes -> recipes` join used in index.ts step 6. */
export interface SlotWithRecipeRow {
  /** `null` for an FR-8.2 / AC Scenario 4 (FRESCO-23) unsafe-slot row — the `!recipe` check below already skips it. */
  recipe_id: string | null
  recipes: {
    id: string
    meta: { raciones?: number } | null
    ingredientes_principales: string[] | null
  } | null
}
