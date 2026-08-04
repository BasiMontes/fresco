// FRESCO-70: permanently deletes the CALLER's own account (`/profile` danger
// zone). Every user-owned table (`user_profiles`, `meal_plans` ->
// `meal_plan_recipes`, `shopping_lists`, `recetas_propias`) is FK'd to
// `auth.users(id) ON DELETE CASCADE` (migrations 20260725120100 /
// 20260803000000), so deleting the `auth.users` row alone is sufficient —
// no RPC or manual row cleanup needed, unlike `reassign-guest-data`'s
// `reassign_guest_data()` RPC.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'
import { logger } from '../_shared/logger.ts'
import type { DeleteAccountResponse } from './types.ts'

const FN_NAME = 'delete-account'

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
