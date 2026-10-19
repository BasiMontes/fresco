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
 * FRESCO-1003 (audit 7b A7-PAY-07): whether the session behind `client` has recorded `kind`
 * for the CURRENT text version. RLS scopes the read to the caller's own rows, so no user id is
 * passed. A new `LEGAL_TEXTS_VERSION` makes this false for everyone until they accept again.
 * Throws on a read error: the caller decides what an unreadable registry means (the checkout
 * refuses, it never lets the payment through unproven).
 */
export async function hasRecordedConsent(client: SupabaseClient<Database>, kind: ConsentKind): Promise<boolean> {
  const { data, error } = await client
    .from('user_consents')
    .select('id')
    .eq('kind', kind)
    .eq('version', LEGAL_TEXTS_VERSION)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}
