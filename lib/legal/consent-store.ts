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

/**
 * When the signed-in user gave the health-data consent for the CURRENT texts
 * version, or `null` (FRESCO-856, ADR-0040). A consent given for an older version
 * does not count: a new version is what makes the wizard ask again. Only reads;
 * the owner is the session (RLS lets a user read their own rows).
 *
 * A read error also answers `null`: the safe failure is to ask for the consent
 * again, never to assume it.
 */
export async function getHealthDataConsentDate(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await client
    .from('user_consents')
    .select('accepted_at')
    .eq('kind', 'health_data')
    .eq('version', LEGAL_TEXTS_VERSION)
    .maybeSingle();
  if (error) {
    console.error('[consents] could not read the health-data consent', error);
    return null;
  }
  return data?.accepted_at ?? null;
}
