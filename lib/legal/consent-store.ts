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
