import type { SupabaseClient, User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'
import { timingSafeEqual } from './timing-safe.ts'

const AUTH_UNAVAILABLE_MESSAGE = 'No pudimos comprobar tu sesión en este momento. Inténtalo de nuevo en unos segundos.'

/**
 * FRESCO-1250: `auth.getUser()` could not say whether the token is valid, as opposed to saying it is not. Only
 * what is clearly the service's fault counts: a failed call to Auth (`AuthRetryableFetchError`, which the SDK
 * uses for a network error or a 502/503/504) or an answer of 5xx (Auth answers 500 when its database is down).
 * Anything else, including an error with no status, is treated as a refusal, so an ambiguous result still denies.
 */
export function isTransientAuthError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false
  const { name, status } = error as { name?: unknown, status?: unknown }
  if (name === 'AuthRetryableFetchError') return true
  return typeof status === 'number' && status >= 500
}

/**
 * The error to throw when `auth.getUser()` did not resolve a user. A 401 means "this session is not valid", and
 * the client reads it as an expired session and sends the person to the login page, so it must not be what a
 * transient failure of Auth or of the database turns into (FRESCO-1250): that is a 503, and the person stays put
 * and can retry. `notAuthorized` is the 401 each caller already used, with its own message.
 */
export function sessionCheckFailure(error: unknown, notAuthorized: HttpError): HttpError {
  return isTransientAuthError(error) ? new HttpError(AUTH_UNAVAILABLE_MESSAGE, 503) : notAuthorized
}

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
  if (error || !data.user) throw sessionCheckFailure(error, new HttpError('No autorizado', 401))

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
  // FRESCO-816 (A6-S8): constant-time, so the response time never says how much of a guess was right.
  if (apiKeyHeader === null || !timingSafeEqual(apiKeyHeader, expected)) {
    throw new HttpError('No autorizado', 401)
  }
}
