import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentKind } from './consent';
import type { Database } from '@/lib/supabase/types';
import { LEGAL_TEXTS_VERSION } from './consent';

/**
 * FRESCO-1007 (audit 7b A7-PRIV-01, A7-PRIV-02) — has this user accepted the CURRENT texts?
 *
 * The registry keeps one row per `(user, kind, version)`. An account that was created before the
 * registry existed has no rows at all, and an account that accepted an older `LEGAL_TEXTS_VERSION`
 * has rows of the wrong version: in both cases the current Terms, Privacy Policy and age
 * confirmation have not been accepted, and the authenticated layout asks for them again
 * (`ReconsentDialog`). Nothing is ever written FOR the user: a consent the person did not give is
 * not evidence of one (GDPR art. 7.1), so the accounts that predate the registry are asked, not
 * backfilled.
 */
export const REQUIRED_CONSENTS: readonly ConsentKind[] = ['age_14', 'terms', 'privacy'];

/** The required kinds with no row at `version`, in the order of `REQUIRED_CONSENTS`. */
export function missingConsents(rows: readonly { kind: string, version: string }[], version: string = LEGAL_TEXTS_VERSION): ConsentKind[] {
  const given = new Set(rows.filter(row => row.version === version).map(row => row.kind));
  return REQUIRED_CONSENTS.filter(kind => !given.has(kind));
}

/**
 * The required consents the signed-in user (the client's own session: RLS scopes the read) has not
 * given at the current version. Throws on a read error; the layout decides to fail open, because a
 * blip of the database must not lock every user out of the app.
 */
export async function getMissingConsents(client: SupabaseClient<Database>): Promise<ConsentKind[]> {
  const { data, error } = await client
    .from('user_consents')
    .select('kind, version')
    .eq('version', LEGAL_TEXTS_VERSION)
    .in('kind', [...REQUIRED_CONSENTS]);

  if (error) {
    throw error;
  }

  return missingConsents(data ?? []);
}
