// FRESCO-70: permanently deletes the CALLER's own account (`/profile` danger
// zone). Every user-owned table (`user_profiles`, `meal_plans` ->
// `meal_plan_recipes`, `shopping_lists`, `recetas_propias`) is FK'd to
// `auth.users(id) ON DELETE CASCADE` (migrations 20260725120100 /
// 20260803000000), so deleting the `auth.users` row alone is sufficient —
// no RPC or manual row cleanup needed, unlike `reassign-guest-data`'s
// `reassign_guest_data()` RPC.
//
// FRESCO-397 (A4-L11, ADR-0023): the JWT alone no longer suffices. A
// registered caller must also prove a RECENT re-authentication — the client
// re-logs through native Supabase Auth and passes the resulting access token
// as `reauthToken`, which this function only VERIFIES (authentic + same user
// + `iat` inside REAUTH_MAX_AGE_SECONDS), never a password. Same posture as
// ADR-0022's `reassign-guest-data` fix. Plus a per-user rate limit, which is
// the only friction for a guest (anonymous) caller — a guest has no password
// to re-enter and its identity is disposable anyway.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { enforceRateLimit } from '../_shared/rate-limit.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'
import { logger } from '../_shared/logger.ts'
import { isTokenRecent } from './reauth.ts'
import type { DeleteAccountRequest, DeleteAccountResponse } from './types.ts'

const FN_NAME = 'delete-account'

// A real user deletes her account at most once. 5/h leaves room for a retry
// after a transient failure without being a useful brute-force surface for
// the re-auth check below.
const RATE_LIMIT_PER_HOUR = 5

// How recent the re-authentication must be. The client mints the token via
// an explicit `signInWithPassword` immediately before calling, so a few
// minutes covers the round-trip with margin; a stale or replayed token
// (e.g. a leaked older access token) falls outside the window.
const REAUTH_MAX_AGE_SECONDS = 5 * 60

/**
 * Throws HttpError(401) unless `reauthToken` is an authentic, recently-issued
 * Supabase access token belonging to `userId`. A single generic message for
 * every failure mode — a missing, forged, wrong-user, or stale token all read
 * the same to the caller.
 */
async function requireRecentReauth(userId: string, reauthToken: string | undefined): Promise<void> {
  const reauthFailed = new HttpError(
    'No pudimos verificar tu identidad. Vuelve a iniciar sesión e inténtalo de nuevo.',
    401,
  )

  if (!reauthToken) throw reauthFailed
  if (!isTokenRecent(reauthToken, REAUTH_MAX_AGE_SECONDS)) throw reauthFailed

  const reauthClient = createRequestClient(`Bearer ${reauthToken}`)
  const { data, error } = await reauthClient.auth.getUser()
  if (error || !data.user || data.user.id !== userId) throw reauthFailed
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // Unlike reassign-guest-data, this must work for any real, registered
    // user, not just guests — no `is_anonymous` restriction. The caller can
    // only ever delete HER OWN account: `requireAuthenticatedUser` resolves
    // identity from her own JWT, and that same id is the only one ever
    // passed to `admin.deleteUser()` below.
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // A4-L11: throttle on the caller's identity before doing any work, so a
    // valid JWT alone can't drive repeated attempts at this endpoint.
    await enforceRateLimit(supabase, { userId: user.id, endpoint: FN_NAME, limit: RATE_LIMIT_PER_HOUR })

    // A4-L11 (ADR-0023): a registered caller proves a recent re-auth. A
    // guest has no password to re-enter — the rate limit above is its only
    // gate, which is acceptable: a guest carries throwaway data and this
    // call deletes the anonymous identity itself.
    if (!user.is_anonymous) {
      const body = await req.json().catch(() => ({})) as DeleteAccountRequest
      await requireRecentReauth(user.id, body.reauthToken)
    }

    // Privileged deletion — only this function holds the service-role
    // client that can call `auth.admin.deleteUser()` (same posture as
    // `reassign-guest-data`'s cleanup step).
    const serviceClient = createServiceRoleClient()
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      logger.error('admin.deleteUser failed', { fn: FN_NAME, userId: user.id, error: deleteError.message })
      throw new HttpError('No se pudo eliminar la cuenta.', 500)
    }

    const response: DeleteAccountResponse = { deleted: true }
    return jsonResponse(response, { req })
  }
  catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
