import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface Sustitucion { original: string, sustituto: string }

export interface SlotSubstitutionContext {
  slotId: string
  sustitucionIngrediente: Sustitucion | null
}

/**
 * Resolves the `?slot=` query param on `/recipes/[id]` into substitution
 * context for `IngredientList`, or `null` when it doesn't apply. Utility,
 * not a public API — silent-fail per `references/error-handling.md`: an
 * invalid, missing, or mismatched slot degrades to "no substitution UI",
 * never a page-level error. RLS (`mpr_select_own`) already scopes the read
 * to the caller's own slot; a `slot` id belonging to another user simply
 * resolves to `null` here, same as a nonexistent one.
 */
export async function getSlotSubstitutionContext(
  client: SupabaseClient<Database>,
  slotId: string | undefined,
  recipeId: string,
): Promise<SlotSubstitutionContext | null> {
  if (!slotId) {
    return null;
  }

  const { data, error } = await client
    .from('meal_plan_recipes')
    .select('id, recipe_id, sustitucion_ingrediente')
    .eq('id', slotId)
    .maybeSingle();

  if (error || !data || data.recipe_id !== recipeId) {
    if (error) {
      console.error('[getSlotSubstitutionContext] read failed, degrading to no substitution UI', error);
    }
    return null;
  }

  return {
    slotId: data.id,
    sustitucionIngrediente: data.sustitucion_ingrediente as Sustitucion | null,
  };
}
