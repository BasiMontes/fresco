import { flushPendingConsents as flushPendingConsentsFor } from '@/lib/legal/consent-client';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: `lib/legal/consent-client` bound to the signed-in browser session. */

/** Records the consents parked in the user's metadata (FRESCO-794) and clears them. Idempotent. */
export async function flushPendingConsents() {
  return flushPendingConsentsFor(createClient());
}
