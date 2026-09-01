import type { SupabaseClient, User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

/**
 * Public method, fails fast (CLAUDE.md §10): throws HttpError(401) rather
 * than returning a nullable user. NFR-SEC-1: every Edge Function call must
 * resolve a real Supabase Auth user before touching any data.
 *
 * EPIC-FRESCO-6 / FR-6.1 guest mode (ADR-0003, FRESCO-17): resolved via
 * Supabase Anonymous Sign-In — an anonymous session is a fully-formed Auth
 * session with a real JWT and `auth.uid()`, so it satisfies this check
 * unmodified. No guest-specific branch needed here; `data.user.is_anonymous`
 * is available on the returned `User` if a caller ever needs to distinguish
 * guest from registered.
 */
export async function requireAuthenticatedUser(
  req: Request,
  supabase: SupabaseClient
): Promise<User> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError('No autorizado', 401)

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new HttpError('No autorizado', 401)

  return data.user
}

/**
 * Public method, fails fast: throws HttpError(401) unless the caller's
 * `apikey` header is EXACTLY this project's own secret key.
 *
 * For Edge Functions invoked by pg_cron -> pg_net (ADR-0011), never by a
 * browser or a user's own session. This project uses the new-style
 * `sb_secret_...` key (not the legacy service_role JWT) — per Supabase's
 * own migration guide, that key type can only be sent on the `apikey`
 * header (`Authorization: Bearer` rejects it with "Invalid JWT", since it
 * isn't a JWT), and the platform's `verify_jwt` gate doesn't understand it
 * at all, so this function must be deployed with `verify_jwt: false` and do
 * its own check here. This check narrows the caller to exactly the secret
 * key, which only this project's own `net.http_post` call (sourced from
 * Supabase Vault in the scheduling migration, never hardcoded) ever
 * presents. A function that calls this must never also accept a real
 * user's JWT — it has no per-user data to scope a request to.
 */
export function requireServiceRoleCaller(req: Request): void {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!secretKeysRaw) {
    // Missing on this project's own Edge Function runtime would be a
    // deployment misconfiguration, not a caller problem — 500, not 401.
    throw new HttpError('Error interno del servidor', 500)
  }

  const expected = (JSON.parse(secretKeysRaw) as Record<string, string>).default
  if (!expected) {
    throw new HttpError('Error interno del servidor', 500)
  }

  const apiKeyHeader = req.headers.get('apikey')
  if (apiKeyHeader !== expected) {
    throw new HttpError('No autorizado', 401)
  }
}
