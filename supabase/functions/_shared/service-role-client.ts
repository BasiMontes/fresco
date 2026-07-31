// ADR-0004 (FRESCO-20): the first service-role client factory in this
// project. Deliberately separate from `supabase-client.ts`'s
// `createRequestClient()` (anon key, RLS-scoped to the caller) so the
// privilege distinction is visible at every import site — a reviewer
// grepping for this import knows exactly which functions hold the more
// powerful credential. Never use this client to satisfy a request on the
// caller's behalf without an independent authorization check first (see
// `reassign-guest-data/index.ts`'s password-verification step).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}
