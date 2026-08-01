import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
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
