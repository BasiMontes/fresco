import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/** Everything `GET /api/profile/export` writes into the CSV, as the database returns it. */
export interface UserDataExport {
  profile: Record<string, unknown> | null
  mealPlans: Record<string, unknown>[]
  shoppingLists: Record<string, unknown>[]
  recetasPropias: Record<string, unknown>[]
}

/**
 * Reads the user's own rows for the CSV backup (FRESCO-70 / FRESCO-163).
 * Server-side client only, no service role: every query is subject to the
 * caller's own RLS policies, so it can only ever read her own rows. The four
 * reads run concurrently. Throws the FIRST error, in the order
 * profile, meal plans, shopping lists, own recipes.
 *
 * FRESCO-810: moved out of `app/api/profile/export/route.ts` (ADR-0041); the
 * route keeps the CSV shaping and the response.
 */
export async function readUserDataForExport(client: SupabaseClient<Database>, userId: string): Promise<UserDataExport> {
  const [profileResult, mealPlansResult, shoppingListsResult, recetasResult] = await Promise.all([
    client.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('meal_plans').select('*, meal_plan_recipes(*)').eq('user_id', userId),
    client.from('shopping_lists').select('*').eq('user_id', userId),
    client.from('recetas_propias').select('*').eq('user_id', userId),
  ]);

  const firstError = profileResult.error ?? mealPlansResult.error ?? shoppingListsResult.error ?? recetasResult.error;
  if (firstError) {
    throw firstError;
  }

  return {
    profile: profileResult.data,
    mealPlans: (mealPlansResult.data ?? []),
    shoppingLists: shoppingListsResult.data ?? [],
    recetasPropias: recetasResult.data ?? [],
  };
}
