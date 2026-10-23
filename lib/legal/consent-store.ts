import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentKind } from './consent';
import type { Database } from '@/lib/supabase/types';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * Records `kinds` for `userId` at the CURRENT text version (FRESCO-794, ADR-0040; FRESCO-1007).
 *
 * This is the only writer of the registry, and it takes a SERVICE-ROLE client: the table has no
 * INSERT grant for a client role any more, because a client that skipped the route could insert any
 * version it liked. The caller (`POST /api/consents`) authenticates the session first and passes
 * `user.id` from it; the version is `LEGAL_TEXTS_VERSION` and never caller input. The database
 * function `record_consents` ignores a repeated `(user, kind, version)`, so a retry or a second tab
 * is harmless, and refuses a user past 100 rows.
 */
export async function recordConsents(client: SupabaseClient<Database>, { userId, kinds }: { userId: string, kinds: ConsentKind[] }) {
  return client.rpc('record_consents', { p_user_id: userId, p_kinds: kinds, p_version: LEGAL_TEXTS_VERSION });
}

/**
 * FRESCO-1003 (audit 7b A7-PAY-07): whether the session behind `client` has recorded `kind`
 * for the CURRENT text version. RLS scopes the read to the caller's own rows, so no user id is
 * passed. A new `LEGAL_TEXTS_VERSION` makes this false for everyone until they accept again.
 * Throws on a read error: the caller decides what an unreadable registry means (the checkout
 * refuses, it never lets the payment through unproven).
 *
 * FRESCO-1021: with `since`, only a row accepted at or after that instant counts. That is how the
 * checkout asks for a `withdrawal_waiver` of THIS purchase and not one from an earlier
 * subscription. The registry can now hold several waiver rows for one version, so the read takes
 * the first row (`limit(1)`) instead of `maybeSingle()`, which fails when more than one matches.
 */
export async function hasRecordedConsent(
  client: SupabaseClient<Database>,
  { kind, since }: { kind: ConsentKind, since?: Date },
): Promise<boolean> {
  let query = client
    .from('user_consents')
    .select('id')
    .eq('kind', kind)
    .eq('version', LEGAL_TEXTS_VERSION);

  if (since) {
    query = query.gte('accepted_at', since.toISOString());
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0) > 0;
}
