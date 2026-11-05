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

/**
 * FRESCO-1125 (audit 8 A8-PRIV-04): `health_data` is not required of everyone, only of a profile that
 * holds allergens or a halal diet (the latter reveals a religious belief, GDPR art. 9). Such a profile is
 * asked again when it has no `health_data` row at the current version, so the reworded text reaches the
 * people who consented under an older one.
 */
export interface MissingConsentsOptions {
  version?: string
  hasHealthData?: boolean
}

/** The required kinds with no row at `version` (plus `health_data` when the profile holds health data). */
export function missingConsents(rows: readonly { kind: string, version: string }[], options: MissingConsentsOptions = {}): ConsentKind[] {
  const { version = LEGAL_TEXTS_VERSION, hasHealthData = false } = options;
  const given = new Set(rows.filter(row => row.version === version).map(row => row.kind));
  const missing = REQUIRED_CONSENTS.filter(kind => !given.has(kind));
  return hasHealthData && !given.has('health_data') ? [...missing, 'health_data'] : missing;
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
    .in('kind', [...REQUIRED_CONSENTS, 'health_data']);

  if (error) {
    throw error;
  }

  // RLS scopes both reads to the caller's own rows.
  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('alergenos, dieta_halal')
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const hasHealthData = (profile?.alergenos?.length ?? 0) > 0 || profile?.dieta_halal === true;

  return missingConsents(data ?? [], { hasHealthData });
}
