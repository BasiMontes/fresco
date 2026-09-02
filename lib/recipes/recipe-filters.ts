import type { RecipeDieta } from '@schemas';

export type MealTab = 'desayuno' | 'comida' | 'cena';

/**
 * FRESCO-273 — the applied (or draft) state of the filter drawer. Every
 * array is OR-within-section (empty = no restriction from that section),
 * AND-across-sections (a recipe must satisfy every non-empty section).
 * `alergenos` stays exclusion semantics: a checked allergen REMOVES matching
 * recipes rather than requiring them.
 *
 * FRESCO-384 (audit-4 A4-M7): the actual filtering + per-option facet counts
 * moved server-side into the `get_catalog` RPC (they used to run client-side
 * over the whole ~1000-row catalog). This module now only holds the shape and
 * the tiny helpers the drawer still needs on the client.
 */
export interface RecipeFilterState {
  mealTypes: MealTab[]
  cocinas: string[]
  dietas: (keyof RecipeDieta)[]
  alergenos: string[]
}

export const EMPTY_FILTER_STATE: RecipeFilterState = {
  mealTypes: [],
  cocinas: [],
  dietas: [],
  alergenos: [],
};

/**
 * FRESCO-187 / FRESCO-384 — recipes per catalog "page". `/recipes?page=N`
 * returns the first N*this rows so the client's "Ver más" stays an append.
 * Lives here (not in the `'use client'` library component) so the Server
 * Component can import the real value, not a client-reference stub
 * (FRESCO-117 gotcha).
 */
export const RECIPE_PAGE_SIZE = 30;

/** Total number of active filter values across all sections — drives the trigger button's badge. */
export function countActiveFilters(filters: RecipeFilterState): number {
  return filters.mealTypes.length + filters.cocinas.length + filters.dietas.length + filters.alergenos.length;
}
