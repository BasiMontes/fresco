import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentKind } from './consent';
import type { Database } from '@/lib/supabase/types';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * Records `kinds` for the session behind `client` (FRESCO-794, ADR-0040). The
 * owner is the session, never a parameter: `user_consents.user_id` defaults to
 * `auth.uid()` and the INSERT grant is `(kind, version)` only. Recording the
 * same kind twice for the same version is a no-op, so a retry or a second tab
 * is harmless.
 */
export async function recordConsents(client: SupabaseClient<Database>, kinds: ConsentKind[]) {
  return client
    .from('user_consents')
    .upsert(
      kinds.map(kind => ({ kind, version: LEGAL_TEXTS_VERSION })),
      { onConflict: 'user_id,kind,version', ignoreDuplicates: true },
    );
}
