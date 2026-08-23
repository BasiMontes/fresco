// supabase/functions/delete-catalog-recipe/index.ts
//
// Admin-gated hard delete of a catalog recipe (FRESCO-237). `recipes` has no
// authenticated-role write RLS policy — 20260726010000_drop_broken_admin_
// write_policy_on_recipes.sql deliberately left it that way and deferred
// "design a real admin check" to this ticket. requireAdminUser() below is
// that check and IS the authorization boundary; the actual write then goes
// through createServiceRoleClient() to bypass RLS by design, not oversight.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { createServiceRoleClient } from '../_shared/service-role-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { requireAdminUser } from '../_shared/admin.ts'
import { logger } from '../_shared/logger.ts'
import type { DeleteCatalogRecipeRequest, DeleteCatalogRecipeResponse } from './types.ts'

const FN_NAME = 'delete-catalog-recipe'

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 2. Admin gate — the real authorization boundary (comments.md Decision 1/2)
    requireAdminUser(user)

    // 3. Parse + validate body
    const body: DeleteCatalogRecipeRequest = await req.json()
    const { recipe_id } = body
    if (!recipe_id) {
      throw new HttpError('Falta el campo obligatorio: recipe_id', 400)
    }

    // Service-role client: recipes has zero authenticated-role write policy,
    // so even an allowlisted admin's own JWT-scoped client can't write here.
    const serviceClient = createServiceRoleClient()

    // 4. Confirm the recipe exists before touching anything else
    const { data: recipe, error: recipeError } = await serviceClient
      .from('recipes')
      .select('id, slug')
      .eq('id', recipe_id)
      .maybeSingle()

    if (recipeError) {
      logger.error('Failed to read recipe', { fn: FN_NAME, error: recipeError.message })
      throw new HttpError('Error interno del servidor', 500)
    }
    if (!recipe) throw new HttpError('Receta no encontrada', 404)

    // 5. FK-restrict precheck (comments.md Decision 4): meal_plan_recipes.recipe_id
    // is ON DELETE RESTRICT, so an unchecked delete would surface as an opaque 500.
    const { count, error: countError } = await serviceClient
      .from('meal_plan_recipes')
      .select('id', { count: 'exact', head: true })
      .eq('recipe_id', recipe_id)

    if (countError) {
      logger.error('Failed to count meal_plan_recipes references', { fn: FN_NAME, error: countError.message })
      throw new HttpError('Error interno del servidor', 500)
    }
    if (count && count > 0) {
      throw new HttpError(
        `La receta está referenciada por ${count} plan(es) de comida y no se puede eliminar.`,
        409
      )
    }

    // 6. Delete — RLS is bypassed intentionally via the service-role client
    const { error: deleteError } = await serviceClient
      .from('recipes')
      .delete()
      .eq('id', recipe_id)

    if (deleteError) {
      logger.error('Failed to delete recipe', { fn: FN_NAME, error: deleteError.message })
      throw new HttpError('Error eliminando la receta', 500)
    }

    const response: DeleteCatalogRecipeResponse = { id: recipe.id, slug: recipe.slug }
    return jsonResponse(response, { req })
  } catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
