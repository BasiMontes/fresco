// Admin allowlist gate (FRESCO-237). Not a role/is_admin DB column — see
// .context/PBI/tech-debts/TECHDEBT-FRESCO-237-catalogo-de-recetas-definir-mecanismo-de-borrado-d/comments.md
// Decision 1: single-founder app today, no role system exists anywhere in
// the schema, and 20260726010000_drop_broken_admin_write_policy_on_recipes.sql
// explicitly deferred "design a real admin check" to this ticket. The
// allowlist IS the authorization boundary — `recipes` has zero authenticated
// -role write policy, so callers that pass this check still need a
// service-role client to actually write (see service-role-client.ts).
import type { User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

/**
 * Public method, fails fast (CLAUDE.md §10): throws HttpError(403) rather
 * than returning a boolean, mirroring requireAuthenticatedUser's shape in
 * auth.ts so callers compose the two checks identically.
 */
export function requireAdminUser(user: Pick<User, 'id'>): void {
  const allowlist = (Deno.env.get('ADMIN_USER_ID') ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)

  if (!allowlist.includes(user.id)) {
    throw new HttpError('No autorizado', 403)
  }
}
