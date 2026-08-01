// supabase/functions/update-recipe-status/index.ts
//
// Orchestrates FR-5.1-FR-5.3, api-contracts.md §4. No LLM call in this
// function — it is pure authorized CRUD, so unlike the other two Edge
// Functions there is no "prompt-building" piece to defer: this is the real,
// complete implementation.
//
// The recipe's aggregate learning fields (veces_cocinada/veces_descartada/
// rating_promedio) are updated by the DB trigger recipe_learning_trigger
// (supabase/migrations/20260725120200_create_recipe_learning_trigger.sql),
// not by this function directly — this function's only job is the
// authorized, validated write to meal_plan_recipes.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { logger } from '../_shared/logger.ts'
import type { SlotOwnershipRow, UpdateRecipeStatusRequest, UpdateRecipeStatusResponse } from './types.ts'

const FN_NAME = 'update-recipe-status'
const TERMINAL_STATES = new Set(['cocinada', 'descartada'])

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 2. Parse + validate body (api-contracts.md §4 error table)
    const body: UpdateRecipeStatusRequest = await req.json()
    const { meal_plan_recipe_id, estado, rating, nueva_recipe_id } = body

    if (!meal_plan_recipe_id || !estado) {
      throw new HttpError('Faltan campos obligatorios: meal_plan_recipe_id, estado', 400)
    }
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new HttpError('El rating debe estar entre 1 y 5', 400)
    }
    if (estado === 'sustituida' && !nueva_recipe_id) {
      throw new HttpError('Se requiere nueva_recipe_id para estado "sustituida"', 400)
    }

    // 3. Load the slot + its parent plan's owner, in one query
    const { data: slot, error: slotError } = await supabase
      .from('meal_plan_recipes')
      .select('id, estado, meal_plans ( user_id )')
      .eq('id', meal_plan_recipe_id)
      .single<SlotOwnershipRow>()

    if (slotError || !slot) throw new HttpError('Slot no encontrado', 404)

    // 4. Ownership check (RLS also enforces this at the DB layer; this gives
    // callers a precise 403 instead of an RLS-shaped empty result).
    if (slot.meal_plans?.user_id !== user.id) {
      throw new HttpError('No autorizado', 403)
    }

    // 5. Terminal-state guard (FR-5.1: cocinada/descartada cannot be re-patched)
    if (TERMINAL_STATES.has(slot.estado)) {
      throw new HttpError(
        `No se puede cambiar el estado de una receta ya marcada como "${slot.estado}"`,
        409
      )
    }

    // 6. Apply the update — recipe_learning_trigger reacts to this in the DB
    const updatePayload: Record<string, unknown> = { estado }
    if (rating !== undefined) updatePayload.rating = rating
    if (nueva_recipe_id !== undefined) updatePayload.recipe_id = nueva_recipe_id

    const { error: updateError } = await supabase
      .from('meal_plan_recipes')
      .update(updatePayload)
      .eq('id', meal_plan_recipe_id)

    if (updateError) {
      logger.error('Failed to update meal_plan_recipes', { fn: FN_NAME, error: updateError.message })
      throw new HttpError('Error actualizando el estado', 500)
    }

    const response: UpdateRecipeStatusResponse = { ok: true, estado }
    return jsonResponse(response, { req })
  } catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
