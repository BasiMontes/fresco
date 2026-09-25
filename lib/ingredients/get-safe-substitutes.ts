import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export class IngredientSubstitutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngredientSubstitutionError';
  }
}

export interface SafeIngredientSubstitute {
  ingredienteSustituto: string
  alergenos: string[]
}

/**
 * Safe substitute candidates for `ingrediente`, filtered against the
 * CURRENTLY authenticated caller's own allergens, disliked ingredients, and
 * active diet flags (`get_safe_ingredient_substitutes`, `ADR-0032`). The RPC
 * takes no identity parameter — it reads `auth.uid()` itself — so this
 * wrapper never accepts or forwards a user id either.
 *
 * Never throws for "no safe substitute exists": that is a normal outcome,
 * returned as an empty array so the caller can render an explicit message
 * (FRESCO-534's own AC) instead of treating it as a failure.
 */
export async function getSafeSubstitutes(
  client: SupabaseClient<Database>,
  ingrediente: string,
): Promise<SafeIngredientSubstitute[]> {
  const { data, error } = await client.rpc('get_safe_ingredient_substitutes', { p_ingrediente: ingrediente });

  if (error) {
    throw new IngredientSubstitutionError(`No se pudieron buscar sustitutos seguros para "${ingrediente}": ${error.message}`);
  }

  return (data ?? []).map(row => ({
    ingredienteSustituto: row.ingrediente_sustituto,
    alergenos: row.alergenos,
  }));
}
