import type { Database } from './types';
import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';

/**
 * Browser-side Supabase client, scoped to the signed-in user's session via
 * `@supabase/ssr`'s cookie-backed storage — never the service role. Mirrors
 * the RLS-by-design posture of the Edge Function client
 * (`supabase/functions/_shared/supabase-client.ts`): every query this client
 * makes is subject to the calling user's RLS policies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
