// Deno-side Supabase client factory shared by all three Edge Functions.
// Uses the `npm:` specifier — Supabase's current documented import for Edge
// Functions (verified via the Supabase docs search tool, 2026-07-25). The
// founder drafts (fresco-edge-function-generate.md, etc.) used the older
// `https://esm.sh/@supabase/supabase-js@2` URL-import pattern; `npm:` is the
// more current, more reliable specifier and is used here instead.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * Builds a Supabase client scoped to the calling user's JWT, so every query
 * this client makes is subject to that user's RLS policies (NFR-SEC-2) —
 * never the service role. Every Edge Function in this project uses this
 * factory rather than a raw `createClient` call, so RLS scoping can't be
 * silently forgotten in a new function.
 */
export function createRequestClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}
