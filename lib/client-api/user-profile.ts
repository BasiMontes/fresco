import { getPlanTierForAnalytics as getPlanTierForAnalyticsFor, markRoutesNoticeDismissed as markRoutesNoticeDismissedFor, updateNombre as updateNombreFor, upsertUserProfile as upsertUserProfileFor } from '@/lib/api/user-profile';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: `lib/api/user-profile` bound to the signed-in browser session. */

/** Never throws: any failure reads as `'free'` (an analytics property must not break a flow). */
export async function getPlanTierForAnalytics(userId: Parameters<typeof getPlanTierForAnalyticsFor>[1]) {
  return getPlanTierForAnalyticsFor(createClient(), userId);
}

export async function markRoutesNoticeDismissed(userId?: Parameters<typeof markRoutesNoticeDismissedFor>[1]) {
  return markRoutesNoticeDismissedFor(createClient(), userId);
}

export async function updateNombre(nombre: Parameters<typeof updateNombreFor>[1]) {
  return updateNombreFor(createClient(), nombre);
}

export async function upsertUserProfile(profile: Parameters<typeof upsertUserProfileFor>[1]) {
  return upsertUserProfileFor(createClient(), profile);
}
