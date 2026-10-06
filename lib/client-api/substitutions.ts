import { confirmSubstitution as confirmSubstitutionFor } from '@/lib/ingredients/confirm-substitution';
import { getSafeSubstitutes as getSafeSubstitutesFor } from '@/lib/ingredients/get-safe-substitutes';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: the ingredient-substitution RPCs, bound to the signed-in browser session. */

export async function getSafeSubstitutes(ingrediente: Parameters<typeof getSafeSubstitutesFor>[1]) {
  return getSafeSubstitutesFor(createClient(), ingrediente);
}

export async function confirmSubstitution(args: Parameters<typeof confirmSubstitutionFor>[1]) {
  return confirmSubstitutionFor(createClient(), args);
}
