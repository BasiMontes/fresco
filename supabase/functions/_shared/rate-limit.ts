// ADR-0010, FRESCO-243: shared wrapper around the check_and_increment_rate_limit
// Postgres RPC. The RPC does the check-and-increment as one atomic statement
// (no read-then-write race) and self-exempts the e2e/smoke test accounts via
// public.rate_limit_exempt_users, so an adopting Edge Function only has to
// pass its own `endpoint` string and per-user `limit`.
//
// generate-meal-plan predates this file and keeps its own local copy
// (generate-meal-plan/rate-limit.ts); new call sites use this one.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

/**
 * Throws a 429 unless the rate-limit RPC explicitly reported `true`. Anything
 * else — `false`, `null`, `undefined` — is treated as blocked (fail-closed,
 * ADR-0010 Decision 2): an ambiguous result never silently lets a request
 * through.
 */
export function assertRateLimitAllowed(allowed: boolean | null | undefined): void {
  if (allowed !== true) {
    throw new HttpError('Has alcanzado el límite de peticiones, inténtalo de nuevo en unos minutos', 429)
  }
}

interface EnforceRateLimitArgs {
  userId: string
  endpoint: string
  limit: number
  windowSeconds?: number
}

/**
 * Calls check_and_increment_rate_limit and enforces its verdict. A failure of
 * the RPC itself is a 500 (the check could not run), not a silent pass.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  { userId, endpoint, limit, windowSeconds = 3600 }: EnforceRateLimitArgs,
): Promise<void> {
  const { data: allowed, error } = await supabase.rpc('check_and_increment_rate_limit', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw new HttpError('Error verificando el límite de peticiones', 500)
  assertRateLimitAllowed(allowed)
}
