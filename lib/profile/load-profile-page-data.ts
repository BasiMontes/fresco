import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { listPastMealPlanWeeks } from '@/lib/api/meal-plan';
import { getPaymentFailedAt, getUserDietaryPreferences, getUserNombre, getUserPlan, getUserTrialAvailable } from '@/lib/api/user-profile';

/**
 * Every server-side read `/profile` needs. They are mutually independent —
 * run them concurrently rather than paying for sequential round trips. Each
 * keeps its own fallback via `.catch()` (same conservative-default judgment
 * calls as before) so one call's rejection can't take the others down with it.
 */
export async function loadProfilePageData(supabase: SupabaseClient<Database>, userId: string | undefined) {
  const [plan, paymentFailedAt, nombre, dietaryPreferences, pastWeeks, trialAvailable] = await Promise.all([
    getUserPlan(supabase, userId).catch((error) => {
      // Same judgment call as every other page reading server-side profile
      // data: a real read failure defaults to the more conservative 'free'
      // (shows the upsell) rather than crashing the page.
      console.error('[/profile] getUserPlan failed, defaulting to free', error);
      return 'free' as const;
    }),
    getPaymentFailedAt(supabase, userId).catch((error) => {
      // Same conservative-default judgment call: a real read failure hides
      // the aviso rather than crashing the page.
      console.error('[/profile] getPaymentFailedAt failed, defaulting to null', error);
      return null;
    }),
    getUserNombre(supabase, userId).catch((error) => {
      // Same conservative fallback as `plan` above: a real read failure falls
      // back to `null` (the form renders empty) rather than crashing the page.
      console.error('[/profile] getUserNombre failed, defaulting to null', error);
      return null;
    }),
    getUserDietaryPreferences(supabase, userId).catch((error) => {
      // Same conservative-default judgment call as `plan`/`nombre` above: a
      // real read failure falls back to a safe empty state (`PreferencesForm`
      // still renders, just unchecked) rather than crashing the page or
      // silently hiding the whole section.
      console.error('[/profile] getUserDietaryPreferences failed, defaulting to empty preferences', error);
      return {
        num_personas: 2,
        adultos: 2,
        ninos: 0,
        dieta_vegetariano: false,
        dieta_vegano: false,
        dieta_sin_gluten: false,
        dieta_sin_lactosa: false,
        dieta_sin_huevo: false,
        dieta_keto: false,
        dieta_halal: false,
        alergenos: [],
        ingredientes_odiados: [],
        cocinas_favoritas: [],
      };
    }),
    listPastMealPlanWeeks(supabase, userId).catch((error) => {
      // Same conservative fallback as the reads above: a failure hides the
      // history card's content (empty state) rather than crashing the page.
      console.error('[/profile] listPastMealPlanWeeks failed, defaulting to none', error);
      return [];
    }),
    getUserTrialAvailable(supabase, userId).catch((error) => {
      // FRESCO-822: unlike the reads above, the safe default here is NOT the
      // permissive one. If we cannot tell whether the trial is still available we
      // must not promise it: the checkout charges from day one to anyone who used it.
      console.error('[/profile] getUserTrialAvailable failed, defaulting to no trial promise', error);
      return false;
    }),
  ]);

  return { plan, paymentFailedAt, nombre, dietaryPreferences, pastWeeks, trialAvailable };
}
