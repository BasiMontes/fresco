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
//
// A4-H1 / A4-L7 (audit-4): the substitution path (`estado: 'sustituida'`)
// applied `nueva_recipe_id` blind — no state whitelist, no allergen/diet
// re-filter, no duplicate check, no rate limit. All four are enforced below.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { enforceRateLimit } from '../_shared/rate-limit.ts'
import { logger } from '../_shared/logger.ts'
import { assertEstadoValido, assertRatingValido } from './validation.ts'
import type { SlotOwnershipRow, UpdateRecipeStatusRequest, UpdateRecipeStatusResponse } from './types.ts'

const FN_NAME = 'update-recipe-status'
const TERMINAL_STATES = new Set(['cocinada', 'descartada'])
// Legit use is ~21 slot marks + ratings + the odd substitution per week; a
// real session closes a week in minutes. 60/hour never touches a human and
// caps abuse of the global learning aggregates the DB trigger maintains.
const RATE_LIMIT_PER_HOUR = 60

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 1.5. Rate limit (A4-H1, ADR-0010): checked before body work so a
    // rate-limited caller gets a fast 429. The RPC is a single atomic
    // check-and-increment and self-exempts the e2e/smoke test accounts.
    await enforceRateLimit(supabase, { userId: user.id, endpoint: FN_NAME, limit: RATE_LIMIT_PER_HOUR })

    // 2. Parse + validate body (api-contracts.md §4 error table)
    const body: UpdateRecipeStatusRequest = await req.json()
    const { meal_plan_recipe_id, estado, rating, nueva_recipe_id } = body

    if (!meal_plan_recipe_id || !estado) {
      throw new HttpError('Faltan campos obligatorios: meal_plan_recipe_id, estado', 400)
    }
    assertEstadoValido(estado) // A4-L7: whitelist, not the raw enum error
    assertRatingValido(rating) // A4-L7: integer 1-5, rejects "3" / 3.7 / null
    if (estado === 'sustituida' && !nueva_recipe_id) {
      throw new HttpError('Se requiere nueva_recipe_id para estado "sustituida"', 400)
    }

    // 3. Load the slot + its parent plan's id + owner, in one query
    const { data: slot, error: slotError } = await supabase
      .from('meal_plan_recipes')
      .select('id, estado, meal_plan_id, meal_plans ( user_id )')
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

    // 6. Substitution safety (A4-H1). get_filtered_recipes is the single
    // structural food-safety enforcement point (ADR-0001, NFR-SEC-3); pass
    // the candidate id through it — zero rows back means the recipe carries a
    // declared allergen, breaks the diet, uses a disliked ingredient, or
    // does not exist. Then reject a recipe already placed elsewhere in the
    // same week's plan.
    if (estado === 'sustituida') {
      // FRESCO-375: untyped Deno client — assert the row shape at the boundary.
      const { data: safeRowsData, error: filterError } = await supabase.rpc('get_filtered_recipes', {
        p_user_id: user.id,
        p_recipe_id: nueva_recipe_id,
      })
      const safeRows = (safeRowsData ?? []) as { id: string }[]

      if (filterError) {
        logger.error('get_filtered_recipes failed during substitution', { fn: FN_NAME, error: filterError.message })
        throw new HttpError('Error validando la receta de sustitución', 500)
      }
      if (safeRows.length === 0) {
        throw new HttpError(
          'La receta de sustitución no es válida para tu perfil (alérgeno, dieta o ingrediente excluido) o no existe',
          422
        )
      }

      const { data: dupe, error: dupeError } = await supabase
        .from('meal_plan_recipes')
        .select('id')
        .eq('meal_plan_id', slot.meal_plan_id)
        .eq('recipe_id', nueva_recipe_id)
        .neq('id', meal_plan_recipe_id)
        .limit(1)
        .maybeSingle()

      if (dupeError) {
        logger.error('duplicate-slot check failed during substitution', { fn: FN_NAME, error: dupeError.message })
        throw new HttpError('Error validando la receta de sustitución', 500)
      }
      if (dupe) {
        throw new HttpError('Esa receta ya está en tu menú de esta semana', 409)
      }
    }

    // 7. Apply the update — recipe_learning_trigger reacts to this in the DB
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
