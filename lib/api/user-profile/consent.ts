import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * FRESCO-917 — whether the user has recorded the `health_data` consent
 * (GDPR art. 9, ADR-0040), under their own RLS. The database refuses to store
 * allergies or diet without it (`require_health_data_consent`), so `/profile`
 * needs to know whether to ask. Any version counts: the current text version
 * lives in code, not in the database (ADR-0040).
 *
 * Public read — fails fast (throws) on a query error; the caller picks the
 * fallback.
 */
export async function getHasHealthDataConsent(
  supabase: SupabaseClient<Database>,
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from('user_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'health_data')
    .limit(1);

  if (error) {
    throw new Error(`No se pudo leer el consentimiento de datos de salud: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}
