import { hydrateFromSavedProfile as hydrateFromSavedProfileFor } from '@/lib/onboarding/hydrate-saved-profile';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: `lib/onboarding/hydrate-saved-profile` bound to the signed-in browser session. */

/** FRESCO-806: pre-fills the onboarding wizard from the saved profile. Throws when the profile cannot be read. */
export async function hydrateFromSavedProfile(args: Omit<Parameters<typeof hydrateFromSavedProfileFor>[0], 'client'>) {
  return hydrateFromSavedProfileFor({ ...args, client: createClient() });
}
