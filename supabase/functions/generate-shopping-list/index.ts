// supabase/functions/generate-shopping-list/index.ts
//
// Orchestrates FR-4.1-FR-4.4, api-contracts.md §2. Auth, DB reads/writes,
// ownership checks, ingredient consolidation (deterministic, api-contracts.md
// §2a), and the retry/validation control flow are real, working code. The
// actual Gemini prompt-building (aisle classification wording) is deferred —
// see prompt.ts's TODOs — this is implementation/model-tuning detail for
// /sprint-development, not this bootstrap pass.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { callGemini } from '../_shared/gemini.ts'
import { logger } from '../_shared/logger.ts'
import { consolidateIngredientes } from './consolidator.ts'
import { buildShoppingSystemPrompt, buildShoppingUserPrompt } from './prompt.ts'
import type {
  GenerateShoppingListRequest,
  GenerateShoppingListResponse,
  RawIngrediente,
  ShoppingListModelOutput,
  SlotWithRecipeRow,
} from './types.ts'

const FN_NAME = 'generate-shopping-list'
const MAX_RETRIES = 2

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

    // 9. Classify + normalize via Gemini, with bounded retries (NFR-REL-1).
    // buildShoppingSystemPrompt/buildShoppingUserPrompt are TODO stubs — see
    // prompt.ts — so this loop will fail fast until /sprint-development fills
    // them in. The retry/validation shape itself is real.
    let listaData: ShoppingListModelOutput | null = null
    let lastError = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const systemPrompt = buildShoppingSystemPrompt()
      const userPrompt = buildShoppingUserPrompt({
        ingredientes: ingredientesConsolidados,
        semanaIso: plan.semana_iso,
        numPersonas,
        numRecetas: slots.length,
      })

      const result = await callGemini({
        systemPrompt,
        userPrompt,
        config: {
          temperature: 0.2, // classification task — consistency over variety
          maxOutputTokens: 2048,
        },
      })

      if (!result.ok) {
        lastError = result.errorText ?? 'Gemini call failed'
        continue
      }

      try {
        const parsed = JSON.parse(result.rawText.trim()) as ShoppingListModelOutput

        if (!parsed.pasillos || !Array.isArray(parsed.pasillos)) {
          lastError = 'Respuesta sin campo "pasillos"'
          continue
        }

        // FR-4.1 / NFR-REL-1: retry unless >=90% of consolidated ingredients survived
        const totalItemsIA = parsed.pasillos.reduce((acc, p) => acc + p.items.length, 0)
        if (totalItemsIA < ingredientesConsolidados.length * 0.9) {
          lastError = `IA devolvió solo ${totalItemsIA} de ${ingredientesConsolidados.length} ingredientes`
          continue
        }

        listaData = parsed
        break
      } catch {
        lastError = `JSON inválido en intento ${attempt + 1}`
      }
    }

    if (!listaData) {
      logger.error('Shopping list generation exhausted retries', { fn: FN_NAME, lastError })
      throw new HttpError(`No se pudo generar la lista: ${lastError}`, 502)
    }

    // 10. Persist
    const { data: savedList, error: saveError } = await supabase
      .from('shopping_lists')
      .insert({ meal_plan_id, user_id: user.id, items: listaData.pasillos })
      .select('id')
      .single()

    if (saveError || !savedList) throw new HttpError('Error guardando la lista de compra', 500)

    const response: GenerateShoppingListResponse = {
      shopping_list_id: savedList.id,
      pasillos: listaData.pasillos,
      resumen: listaData.resumen,
    }
    return jsonResponse(response)
  } catch (err) {
    return toErrorResponse(err, FN_NAME)
  }
})
