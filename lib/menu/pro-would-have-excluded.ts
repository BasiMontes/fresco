import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuSemanalPersistido } from '@/lib/api/meal-plan';
import type { Database } from '@/lib/supabase/types';
import { addIsoWeeks } from '@/lib/date/iso-week';

/**
 * FRESCO-1027 — what Pro would have changed in a Free menu, so a Free user can SEE the learning.
 *
 * The engine (`generate-meal-plan/index.ts`, ADR-0001) hard-excludes, for Pro only, every recipe the user
 * marked `cocinada` or `descartada` in the previous two weeks. A Free menu is built without that exclusion,
 * so the same recipes can come back. This reproduces that rule without applying it: a recipe of the current
 * menu that carries such a mark in the two ISO weeks before it. An older discard is NOT counted: Pro only
 * lowers its score (ADR-0008), it does not exclude it, so claiming it would be a promise the engine does not keep.
 */

/** The history window of the engine's `get_recent_recipe_marks(p_weeks => 2)`. */
const HISTORY_WEEKS = 2;

type DecisiveMark = 'cocinada' | 'descartada';

export interface PriorMark {
  recipeId: string
  estado: DecisiveMark
}

export interface MarkedDish {
  id: string
  nombre: string
  estado: DecisiveMark
}

export class PriorMarksError extends Error {}

/**
 * The `cocinada` / `descartada` marks the signed-in user left in the `HISTORY_WEEKS` ISO weeks before
 * `semanaIso`. Reads through RLS (a user sees only their own plans), so no RPC and no migration. Throws on
 * a failed read; the caller decides that a failure hides the notice.
 */
export async function getPriorMarks(
  client: SupabaseClient<Database>,
  { semanaIso, userId }: { semanaIso: string, userId: string },
): Promise<PriorMark[]> {
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, index) => addIsoWeeks(semanaIso, -(index + 1)));

  const { data, error } = await client
    .from('meal_plan_recipes')
    .select('recipe_id, estado, meal_plans!inner(semana_iso, user_id)')
    .eq('meal_plans.user_id', userId)
    .in('meal_plans.semana_iso', weeks)
    .in('estado', ['cocinada', 'descartada']);

  if (error) {
    throw new PriorMarksError(`No se pudieron leer las marcas previas: ${error.message}`);
  }

  // A slot can hold no catalogue recipe (a null `recipe_id`): it has nothing to compare against the menu.
  return (data ?? []).flatMap(row => (row.recipe_id ? [{ recipeId: row.recipe_id, estado: row.estado as DecisiveMark }] : []));
}

/**
 * The distinct dishes of `menu`, in menu order, that Pro would not have served again. A recipe marked both
 * ways in the window counts as `descartada`, the more decisive signal (same collapse as the engine's RPC).
 */
export function proWouldHaveExcluded(
  { menu, priorMarks }: { menu: MenuSemanalPersistido['menu'], priorMarks: readonly PriorMark[] },
): MarkedDish[] {
  const estadoById = new Map<string, DecisiveMark>();
  for (const mark of priorMarks) {
    if (estadoById.get(mark.recipeId) !== 'descartada') {
      estadoById.set(mark.recipeId, mark.estado);
    }
  }

  const seen = new Set<string>();
  const dishes: MarkedDish[] = [];
  for (const slots of Object.values(menu)) {
    for (const recipe of Object.values(slots)) {
      const estado = recipe ? estadoById.get(recipe.id) : undefined;
      if (recipe && estado && !seen.has(recipe.id)) {
        seen.add(recipe.id);
        dishes.push({ id: recipe.id, nombre: recipe.nombre, estado });
      }
    }
  }
  return dishes;
}
