import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { IngredientSubstitutionError } from './get-safe-substitutes';

/**
 * Confirms swapping `ingredienteOriginal` for `ingredienteSustituto` inside
 * one specific meal-plan slot (`confirm_ingredient_substitution`, `ADR-0033`).
 * Never mutates the shared catalog recipe.
 *
 * Public method — fails fast (throws `IngredientSubstitutionError`) on any
 * RPC error, mirroring `swapMealPlanSlots()`'s own convention. Safety
 * re-verification, recipe-membership, and terminal-state checks are all
 * enforced inside the SQL function itself, not re-checked here — a rejection
 * surfaces as this error, not a silent no-op.
 */
export async function confirmSubstitution(
  client: SupabaseClient<Database>,
  slotId: string,
  ingredienteOriginal: string,
  ingredienteSustituto: string,
): Promise<void> {
  const { error } = await client.rpc('confirm_ingredient_substitution', {
    p_slot_id: slotId,
    p_ingrediente_original: ingredienteOriginal,
    p_ingrediente_sustituto: ingredienteSustituto,
  });

  if (error) {
    throw new IngredientSubstitutionError(`No se pudo confirmar la sustitución de "${ingredienteOriginal}": ${error.message}`);
  }
}
