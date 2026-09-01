// ADR-0004 (FRESCO-20): reassigns a guest's generated data to a real,
// pre-existing account when she tries to convert with an email that already
// belongs to that account (FRESCO-19's `email_exists` edge case). See the
// ADR for the full mechanism and why each step exists.

import { createClient } from '@supabase/supabase-js'
import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'
import { logger } from '../_shared/logger.ts'
import type { ReassignGuestDataRequest, ReassignGuestDataResponse } from './types.ts'

const FN_NAME = 'reassign-guest-data'

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. The caller must be an active guest session — this operation only
    // makes sense as "move MY guest data to an account I can prove is mine".
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const guestUser = await requireAuthenticatedUser(req, supabase)

    if (!guestUser.is_anonymous) {
      throw new HttpError('Esta operación es solo para sesiones de invitada.', 400)
    }

    const body: ReassignGuestDataRequest = await req.json()
    const { email, password } = body
    if (!email || !password) {
      throw new HttpError('Faltan campos: email, password', 400)
    }

    // 2. Ownership proof: verify the target account's REAL password via a
    // fresh, unauthenticated client — never trust the caller's word that an
    // account is "hers". A generic 401 either way avoids leaking whether the
    // email exists at all.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.user) {
      throw new HttpError('Credenciales inválidas para esa cuenta.', 401)
    }

    const targetUserId = signInData.user.id

    if (targetUserId === guestUser.id) {
      // Should not happen in practice (FRESCO-19 only reaches this flow on
      // an `email_exists` conflict with a DIFFERENT account) — defensive.
      throw new HttpError('La cuenta indicada ya es la sesión actual.', 400)
    }

    // 3. Privileged move — only this function holds the service-role client
    // that can call reassign_guest_data() (ADR-0004: EXECUTE is revoked from
    // every ordinary role at the DB level).
    const serviceClient = createServiceRoleClient()
    const { data: neutralizedSlots, error: reassignError } = await serviceClient.rpc('reassign_guest_data', {
      p_from_user_id: guestUser.id,
      p_to_user_id: targetUserId,
    })

    if (reassignError) {
      logger.error('reassign_guest_data RPC failed', { fn: FN_NAME, error: reassignError.message })
      throw new HttpError('Error reasignando los datos de invitada.', 500)
    }

    // A4-H2: the RPC re-filters the moved plans against the target account's
    // allergen profile and returns how many slots it had to neutralize.
    if (typeof neutralizedSlots === 'number' && neutralizedSlots > 0) {
      logger.info('reassignment neutralized slots with a target-profile allergen', {
        fn: FN_NAME,
        targetUserId,
        neutralizedSlots,
      })
    }

    // 4. Clean up the now-orphaned anonymous identity (ADR-0003's named,
    // previously-unsolved gap — solved here for exactly this one path). A
    // failure here doesn't undo the data reassignment above, which already
    // succeeded — logged, not surfaced as a request failure.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(guestUser.id)
    if (deleteError) {
      logger.warn('Failed to delete orphaned anonymous user after reassignment', {
        fn: FN_NAME,
        userId: guestUser.id,
        error: deleteError.message,
      })
    }

    const response: ReassignGuestDataResponse = { reassigned: true }
    return jsonResponse(response, { req })
  }
  catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
