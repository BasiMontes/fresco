import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getUserOnboardingProfile } from '@/lib/api/user-profile';
import { isWizardUntouched, profileToWizardData } from '@/lib/onboarding/saved-profile';
import { ONBOARDING_INITIAL_STATE, useOnboardingStore } from '@/lib/store/onboarding-store';

export type HydrationResult = 'hydrated' | 'no-profile' | 'kept-edits';

/**
 * FRESCO-806 (audit-6 A6-L5) — fills the wizard from the signed-in user's saved
 * profile, once, before the wizard is shown.
 *
 * - No saved profile (a first-time visitor): nothing to do, the wizard starts empty.
 * - The wizard already holds edits (the store persists in sessionStorage, so a
 *   reload mid-wizard keeps them): they win, a pre-fill would erase them.
 * - Otherwise the saved values become the wizard's values, so the summary shows
 *   them and "Empezar" saves them back unchanged instead of overwriting them.
 *
 * A read error is thrown, never swallowed: see `useOnboardingSessionGate`.
 */
export async function hydrateFromSavedProfile({ client, userId }: { client: SupabaseClient<Database>, userId: string }): Promise<HydrationResult> {
  const saved = await getUserOnboardingProfile(client, userId);
  if (!saved) {
    return 'no-profile';
  }
  if (!isWizardUntouched(useOnboardingStore.getState(), ONBOARDING_INITIAL_STATE)) {
    return 'kept-edits';
  }
  useOnboardingStore.setState(profileToWizardData(saved, ONBOARDING_INITIAL_STATE));
  return 'hydrated';
}
