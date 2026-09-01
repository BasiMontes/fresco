import type { Recipe, RecipeDieta } from '@schemas';

export type MealTab = 'desayuno' | 'comida' | 'cena';

/**
 * FRESCO-273 — the applied (or draft) state of the filter drawer. Every
 * array is OR-within-section (empty = no restriction from that section),
 * AND-across-sections (a recipe must satisfy every non-empty section).
 * `alergenos` stays exclusion semantics: a checked allergen REMOVES matching
 * recipes rather than requiring them.
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

/** FRESCO-66's null-`clasificacion` fallback still applies: no meal types checked → show everything, same as an unclassified recipe never being excluded by this section. */
function matchesMealTypes(recipe: Recipe, mealTypes: MealTab[]): boolean {
  if (mealTypes.length === 0) { return true; }
  return mealTypes.includes(recipe.clasificacion?.tipo_plato as MealTab);
}

function matchesCocinas(recipe: Recipe, cocinas: string[]): boolean {
  if (cocinas.length === 0) { return true; }
  return cocinas.includes(recipe.clasificacion?.cocina ?? '');
}

function matchesDietas(recipe: Recipe, dietas: (keyof RecipeDieta)[]): boolean {
  if (dietas.length === 0) { return true; }
  return dietas.some(dieta => recipe.dieta?.[dieta] === true);
}

function matchesAlergenos(recipe: Recipe, alergenos: string[]): boolean {
  if (alergenos.length === 0) { return true; }
  // Case-insensitive both sides (FRESCO-361 / A4-B2): an allergen match is
  // food-safety critical and must not depend on the casing a recipe was
  // tagged with. Mirrors the same `lower()` comparison `get_filtered_recipes`
  // now does server-side.
  const recipeAlergenos = new Set((recipe.alergenos ?? []).map(value => value.toLowerCase()));
  return !alergenos.some(alergeno => recipeAlergenos.has(alergeno.toLowerCase()));
}

export function matchesRecipeFilters(recipe: Recipe, filters: RecipeFilterState): boolean {
  return matchesMealTypes(recipe, filters.mealTypes)
    && matchesCocinas(recipe, filters.cocinas)
    && matchesDietas(recipe, filters.dietas)
    && matchesAlergenos(recipe, filters.alergenos);
}

/**
 * Live per-option facet count: how many recipes would remain if `value` were
 * ALSO checked in `section`, given every OTHER section's current selection
 * (the standard e-commerce facet-count algorithm — never counts the section
 * being previewed against its own current selection, so unrelated checks in
 * that same section don't skew the number shown next to an unchecked box).
 */
export function countWithOption<K extends keyof RecipeFilterState>(
  recipes: Recipe[],
  filters: RecipeFilterState,
  section: K,
  value: RecipeFilterState[K][number],
): number {
  const preview: RecipeFilterState = {
    ...filters,
    [section]: [value],
  };
  return recipes.filter(recipe => matchesRecipeFilters(recipe, preview)).length;
}

/** Total number of active filter values across all sections — drives the trigger button's badge. */
export function countActiveFilters(filters: RecipeFilterState): number {
  return filters.mealTypes.length + filters.cocinas.length + filters.dietas.length + filters.alergenos.length;
}
