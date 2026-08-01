// supabase/functions/generate-shopping-list/index.ts
//
// Orchestrates FR-4.1-FR-4.4, api-contracts.md §2. Auth, DB reads/writes,
// ownership checks, ingredient consolidation (deterministic, api-contracts.md
// §2a), and aisle classification + cost estimate (deterministic,
// aisle-pricing.ts) are all real, working code (STORY-FRESCO-13). The aisle
// classification used to be a Gemini call (prompt.ts, now deleted) — killed
// per explicit decision to stop all Gemini spend: ingredient names are a
// controlled vocabulary, not free text, so a static map is a reliable,
// zero-cost substitute.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { consolidateIngredientes } from './consolidator.ts'
import { classifyShoppingList } from './aisle-pricing.ts'
import type {
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
  RawIngrediente,
  SlotWithRecipeRow,
} from './types.ts'

const FN_NAME = 'generate-shopping-list'

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 2. Parse body
    const body: GenerateShoppingListRequest = await req.json()
    if (!body.meal_plan_id) throw new HttpError('Falta meal_plan_id', 400)
    const { meal_plan_id } = body

    // 3. Plan must exist and belong to the caller
    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .select('id, semana_iso, user_id')
      .eq('id', meal_plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) throw new HttpError('Plan no encontrado', 404)

    // 4. No list may already exist for this plan (unique_plan_lista constraint backs this too)
    const { data: existingList } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('meal_plan_id', meal_plan_id)
      .maybeSingle()

    if (existingList) throw new HttpError('Ya existe una lista para este plan', 409)

    // 5. Household size (defaults to 2 if the profile lookup comes back empty —
    // not itself a documented error case for this endpoint, matches the founder draft)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('num_personas')
      .eq('id', user.id)
      .maybeSingle()

    const numPersonas = profile?.num_personas ?? 2

    // 6. Load the 21 slots with their recipes' ingredients. `recipes` is the
    // live JSONB-shaped table — servings live at meta.raciones, not a
    // top-level `raciones` column (unlike fresco-shopping-list.md's draft
    // query, which assumed a typed `raciones` column that doesn't exist here).
    const { data: slots, error: slotsError } = await supabase
      .from('meal_plan_recipes')
      .select('recipe_id, recipes ( id, meta, ingredientes_principales )')
      .eq('meal_plan_id', meal_plan_id)
      .returns<SlotWithRecipeRow[]>()

    if (slotsError || !slots || slots.length === 0) {
      throw new HttpError('No se encontraron recetas para este plan', 404)
    }

    // 7. Flatten into raw (pre-consolidation) ingredients
    const rawIngredientes: RawIngrediente[] = []
    for (const slot of slots) {
      const recipe = slot.recipes
      if (!recipe) continue

      const racionesReceta = recipe.meta?.raciones ?? 4
      const ingredientes = recipe.ingredientes_principales ?? []

      for (const ingrediente of ingredientes) {
        rawIngredientes.push({
          nombre: ingrediente,
          receta_id: recipe.id,
          raciones_receta: racionesReceta,
          raciones_usuario: numPersonas,
        })
      }
    }

    // 8. Consolidate (FR-4.1, deterministic — no LLM involved)
    const ingredientesConsolidados = consolidateIngredientes(rawIngredientes)
    if (ingredientesConsolidados.length === 0) {
      throw new HttpError('No se pudieron consolidar ingredientes', 422)
    }

    // 9. Classify + estimate cost — deterministic, cannot fail the way a
    // Gemini call could, so no retry loop needed.
    const listaData = classifyShoppingList(ingredientesConsolidados)

    // 10. Persist
    const { data: savedList, error: saveError } = await supabase
      .from('shopping_lists')
      .insert({
        meal_plan_id,
        user_id: user.id,
        items: listaData.pasillos,
        coste_estimado_min: listaData.resumen.coste_estimado_min,
        coste_estimado_max: listaData.resumen.coste_estimado_max,
      })
      .select('id')
      .single()

    if (saveError || !savedList) throw new HttpError('Error guardando la lista de compra', 500)

    const response: GenerateShoppingListResponse = {
      shopping_list_id: savedList.id,
      pasillos: listaData.pasillos,
      resumen: listaData.resumen,
    }
    return jsonResponse(response, { req })
  } catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
