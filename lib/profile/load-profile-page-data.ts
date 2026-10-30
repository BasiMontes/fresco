import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { listPastMealPlanWeeks } from '@/lib/api/meal-plan';
import { getHasHealthDataConsent, getPaymentFailedAt, getUserDietaryPreferences, getUserNombre, getUserPlan, getUserTrialAvailable } from '@/lib/api/user-profile';

type Client = SupabaseClient<Database>;

/** What one profile read needs: the client, the user, and the route name its failure logs under. */
interface ProfileRead {
  supabase: Client
  userId: string | undefined
  route: string
}

/**
 * Same conservative-default judgment call as `plan`/`nombre`: a real read failure falls back to a
 * safe empty state (`PreferencesForm` still renders, just unchecked) rather than crashing the page
 * or silently hiding the whole section. Shared by `/profile` (the summary row) and
 * `/profile/preferences` (the form), FRESCO-1070.
 */
async function readDietaryPreferences({ supabase, userId, route }: ProfileRead) {
  return getUserDietaryPreferences(supabase, userId).catch((error) => {
    console.error(`[${route}] getUserDietaryPreferences failed, defaulting to empty preferences`, error);
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
  });
}

/**
 * FRESCO-917: unknown means ask again. Showing the consent box to someone who already consented is
 * harmless (ticking it is idempotent); hiding it from someone who has not would leave them unable to save.
 */
async function readHasHealthDataConsent({ supabase, userId, route }: ProfileRead) {
  return getHasHealthDataConsent(supabase, userId).catch((error) => {
    console.error(`[${route}] getHasHealthDataConsent failed, defaulting to not consented`, error);
    return false;
  });
}

/**
 * Every server-side read `/profile` needs. They are mutually independent —
 * run them concurrently rather than paying for sequential round trips. Each
 * keeps its own fallback via `.catch()` (same conservative-default judgment
 * calls as before) so one call's rejection can't take the others down with it.
 *
 * The health-data consent is not read here any more: only the preferences form needs it, and that
 * form lives on `/profile/preferences` since FRESCO-1070.
 */
export async function loadProfilePageData(supabase: Client, userId: string | undefined) {
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
    readDietaryPreferences({ supabase, userId, route: '/profile' }),
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

/** The two reads the `/profile/preferences` form needs (FRESCO-1070), each with the same fallback as on `/profile`. */
export async function loadPreferencesPageData(supabase: Client, userId: string | undefined) {
  const [dietaryPreferences, hasHealthDataConsent] = await Promise.all([
    readDietaryPreferences({ supabase, userId, route: '/profile/preferences' }),
    readHasHealthDataConsent({ supabase, userId, route: '/profile/preferences' }),
  ]);

  return { dietaryPreferences, hasHealthDataConsent };
}
