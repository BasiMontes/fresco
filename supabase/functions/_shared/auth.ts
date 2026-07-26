import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { HttpError } from './http.ts'

/**
 * Public method, fails fast (CLAUDE.md §10): throws HttpError(401) rather
 * than returning a nullable user. NFR-SEC-1: every Edge Function call must
 * resolve a real Supabase Auth user before touching any data.
 *
 * TODO: guest-mode auth unresolved, see business-api-map.md Discovery Gaps.
 * EPIC-FRESCO-6 / FR-6.1 requires a first-time visitor to generate one menu
 * without an account, but every source document (fresco-edge-function-
 * generate.md step 1, NFR-SEC-1) specifies this exact 401-on-missing-header
 * behavior with no carve-out. Whether guest mode needs an anonymous Supabase
 * session, a client-side-only generation path, or a guest-scoped token is
 * not resolved by any source document — not invented here. Resolve
 * explicitly in a future story before EPIC-FRESCO-6 can ship.
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
