import type { DiaSemana } from './meal-plan.types';

// Row shape of `public.shopping_lists` (fresco-schema-sql.md Block 6).
// `items` is the jsonb aisle-grouped structure documented in api-contracts.md §2.

/** One recipe/day this ingredient was pulled from (FRESCO-212). */
export interface ShoppingListItemUso {
  receta: string
  dia: DiaSemana
}

export interface ShoppingListItem {
  nombre: string
  cantidad: number
  unidad: string
  comprado: boolean
  /**
   * Estimated price for this item's own quantity — same deterministic
   * per-unit price table `aisle-pricing.ts` already used to compute the
   * list-level `coste_estimado_min/max`, just kept per item instead of
   * only summed. Optional: lists persisted before this field existed have
   * no value for it.
   */
  precio_estimado?: number
  /**
   * Every distinct (recipe, day) this ingredient was pulled from the meal
   * plan for — lets the UI show "used for X, on Y" per row. Optional:
   * lists persisted before this field existed have no value for it, and an
   * item added from "Sugerencias para ti" (FRESCO-194) has no meal-plan
   * provenance at all.
   */
  usos?: ShoppingListItemUso[]
}

export interface ShoppingListPasillo {
  nombre: string
  orden: number
  items: ShoppingListItem[]
}

export interface ShoppingList {
  id: string
  created_at: string
  updated_at: string
  meal_plan_id: string
  user_id: string
  items: ShoppingListPasillo[]
}
