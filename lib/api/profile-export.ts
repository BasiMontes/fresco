import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/** Everything `GET /api/profile/export` writes into the CSV, as the database returns it. */
export interface UserDataExport {
  profile: Record<string, unknown> | null
  mealPlans: Record<string, unknown>[]
  shoppingLists: Record<string, unknown>[]
  recetasPropias: Record<string, unknown>[]
  favorites: Record<string, unknown>[]
  consents: Record<string, unknown>[]
  pushSubscriptions: Record<string, unknown>[]
  recipeFeedback: Record<string, unknown>[]
}

/**
 * Reads the user's own rows for the CSV backup (FRESCO-70 / FRESCO-163).
 * Server-side client only, no service role: every query is subject to the
 * caller's own RLS policies, so it can only ever read her own rows. The reads
 * run concurrently. Throws the FIRST error, in the order profile, meal plans,
 * shopping lists, own recipes, favorites, consents, push subscriptions.
 *
 * FRESCO-910 (audit C-06, GDPR art. 15/20): favorites, the consent record and
 * the push subscriptions are the user's data too. A push subscription is read
 * WITHOUT its `p256dh` / `auth` keys: they are the credentials to encrypt a
 * push to that browser, not data the person needs back.
 *
 * FRESCO-1109 (A8-PRIV-02): `recipe_user_feedback` (cooked / discarded marks) is closed to
 * every browser role on purpose, so the user-scoped client cannot read it. It is read through the
 * `feedbackClient` (service role), filtered to this one user id taken from the session, and only
 * those rows are returned.
 *
 * FRESCO-810: moved out of `app/api/profile/export/route.ts` (ADR-0041); the
 * route keeps the CSV shaping and the response.
 */
/** `client` is the caller's RLS-bound client; `feedbackClient` is the service-role one, used only for `recipe_user_feedback`. */
export interface ExportClients {
  client: SupabaseClient<Database>
  feedbackClient: SupabaseClient<Database>
}

export async function readUserDataForExport({ client, feedbackClient }: ExportClients, userId: string): Promise<UserDataExport> {
  const [profileResult, mealPlansResult, shoppingListsResult, recetasResult, favoritesResult, consentsResult, pushResult, feedbackResult] = await Promise.all([
    client.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('meal_plans').select('*, meal_plan_recipes(*)').eq('user_id', userId),
    client.from('shopping_lists').select('*').eq('user_id', userId),
    client.from('recetas_propias').select('*').eq('user_id', userId),
    client.from('favorites').select('*').eq('user_id', userId),
    client.from('user_consents').select('*').eq('user_id', userId),
    client.from('push_subscriptions').select('id, created_at, last_used_at, endpoint').eq('user_id', userId),
    feedbackClient.from('recipe_user_feedback').select('recipe_id, cocinada_at, descartada_at').eq('user_id', userId),
  ]);

  const firstError = profileResult.error
    ?? mealPlansResult.error
    ?? shoppingListsResult.error
    ?? recetasResult.error
    ?? favoritesResult.error
    ?? consentsResult.error
    ?? pushResult.error
    ?? feedbackResult.error;
  if (firstError) {
    throw firstError;
  }

  return {
    profile: profileResult.data,
    mealPlans: (mealPlansResult.data ?? []),
    shoppingLists: shoppingListsResult.data ?? [],
    recetasPropias: recetasResult.data ?? [],
    favorites: favoritesResult.data ?? [],
    consents: consentsResult.data ?? [],
    pushSubscriptions: pushResult.data ?? [],
    recipeFeedback: feedbackResult.data ?? [],
  };
}
