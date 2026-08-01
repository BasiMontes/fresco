// supabase/functions/generate-meal-plan/index.ts
//
// ADR-0005: menu-slot selection is a deterministic algorithm
// (`menu-selector.ts`), not an LLM call. The Pro-tier learning explanation
// (FR-5.5) was the one real Gemini call left in this function; it is now
// also deterministic (`buildLearningExplanation` in prompt.ts) — the 1000+
// recipe catalog and the recipe stats already computed here (destacadas,
// recientesEvitadas) are enough to build the explanation without an LLM
// call, so there is no more Gemini spend anywhere in this function.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { logger } from '../_shared/logger.ts'
import { buildLearningExplanation } from './prompt.ts'
import { selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL } from './types.ts'
import type {
  DiaSemana,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  Recipe,
  TipoPlatoSlot,
  UserProfile,
} from './types.ts'

const FN_NAME = 'generate-meal-plan'
const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const MIN_CATALOG_SIZE = 21 // 7 days x 3 slots — FR-2.1
// A recipe counts as "worth mentioning" in the learning explanation when it
// has a real positive signal — a discrete threshold, unlike `menu-selector.ts`'s
// continuous weighted score, since this is prose for a human, not a sort key.
const DESTACADA_MIN_RATING = 4
const DESTACADA_MIN_VECES_COCINADA = 3
const MAX_DESTACADAS_IN_PROMPT = 5

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 2. Parse + validate body
    const body: GenerateMealPlanRequest = await req.json()
    const { semana_iso, fecha_inicio } = body
    if (!semana_iso || !fecha_inicio) {
      throw new HttpError('Faltan campos: semana_iso, fecha_inicio', 400)
    }

    // 3. Load profile (FR-1.1 must already have run)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single<UserProfile>()

    if (profileError || !profile) throw new HttpError('Perfil de usuario no encontrado', 404)

    // 4. No silent overwrite — one plan per user per ISO week
    const { data: existingPlan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('semana_iso', semana_iso)
      .maybeSingle()

    if (existingPlan) {
      throw new HttpError(
        `Ya existe un plan para la semana ${semana_iso}. Elimínalo antes de regenerar.`,
        409
      )
    }

    // 5. FR-8.1 Layer 1: SQL pre-filter by allergen/diet/disliked-ingredient
    const { data: recipes, error: recipesError } = await supabase
      .rpc('get_filtered_recipes', { p_user_id: user.id })
      .returns<Recipe[]>()

    if (recipesError || !recipes || recipes.length < MIN_CATALOG_SIZE) {
      throw new HttpError(
        `Catálogo insuficiente: ${recipes?.length ?? 0} recetas disponibles (mínimo ${MIN_CATALOG_SIZE})`,
        422
      )
    }

    // 6. Pro-only history read (FR-2.5, FR-5.4, ADR-0001). Free stays a
    // single line: recentRecipeIds is [] and selectMenu() never excludes
    // anything for it.
    const isPro = profile.plan === 'pro' || profile.plan === 'family'
    let recentRecipeIds: string[] = []

    if (isPro) {
      const { data: recentIds } = await supabase.rpc('get_recent_recipe_ids', {
        p_user_id: user.id,
        p_weeks: 2,
      })
      recentRecipeIds = recentIds ?? []
    }

    // 7. Select the 21 slots — deterministic, synchronous, cannot itself
    // fail the way an LLM call could (ADR-0005). A slot with no safe
    // candidate becomes NO_SAFE_RECIPE_SENTINEL with a real advertencia,
    // same FR-8.2 / AC Scenario 4 contract as before.
    const recipeMap = new Map<string, Recipe>(recipes.map(r => [r.id, r]))
    const { menu, advertencias } = selectMenu({ candidates: recipes, recentRecipeIds, profile })

    // 8. Pro learning explanation (FR-5.5) — deterministic, built from the
    // recipe stats already computed here. Cannot fail the way a Gemini call
    // could, so no try/catch needed.
    let explicacionAprendizaje: string | null = null
    if (isPro && recentRecipeIds.length > 0) {
      const chosenIds = new Set(
        DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo])).filter(id => id !== NO_SAFE_RECIPE_SENTINEL),
      )
      const destacadas = [...chosenIds]
        .map(id => recipeMap.get(id))
        .filter((r): r is Recipe => r !== undefined
          && ((r.rating_promedio ?? 0) >= DESTACADA_MIN_RATING || r.veces_cocinada >= DESTACADA_MIN_VECES_COCINADA))
        .slice(0, MAX_DESTACADAS_IN_PROMPT)
      const recientesEvitadas = recentRecipeIds.filter(id => recipeMap.has(id)).length

      explicacionAprendizaje = buildLearningExplanation({ destacadas, recientesEvitadas })
    }

    // 9. Persist meal_plans
    const { data: mealPlan, error: planError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        semana_iso,
        fecha_inicio,
        advertencias,
        explicacion_aprendizaje: explicacionAprendizaje,
      })
      .select('id')
      .single()

    if (planError || !mealPlan) throw new HttpError('Error guardando el plan en la BD', 500)

    // 10. Persist the 21 slots. NFR-REL-2: Supabase Edge Functions have no
    // native multi-table transaction, so a failed slot insert triggers a
    // manual compensating delete of the orphaned meal_plans row.
    const slots = DIAS.flatMap(dia =>
      TIPOS.map(tipo => {
        const recipeId = menu[dia][tipo]
        return {
          meal_plan_id: mealPlan.id,
          recipe_id: recipeId === NO_SAFE_RECIPE_SENTINEL ? null : recipeId,
          dia,
          tipo_plato: tipo,
          estado: 'pendiente' as const,
        }
      })
    )

    const { error: slotsError } = await supabase.from('meal_plan_recipes').insert(slots)

    if (slotsError) {
      await supabase.from('meal_plans').delete().eq('id', mealPlan.id)
      logger.error('Slot insert failed, rolled back meal_plan', {
        fn: FN_NAME,
        mealPlanId: mealPlan.id,
        error: slotsError.message,
      })
      throw new HttpError('Error guardando las recetas del plan', 500)
    }

    // 11. Enrich response with full recipe objects, not bare ids
    const menuEnriquecido = Object.fromEntries(
      DIAS.map(dia => [
        dia,
        Object.fromEntries(TIPOS.map((tipo) => {
          const recipeId = menu[dia][tipo]
          return [tipo, recipeId === NO_SAFE_RECIPE_SENTINEL ? null : recipeMap.get(recipeId) ?? null]
        })),
      ])
    )

    const response: GenerateMealPlanResponse = {
      meal_plan_id: mealPlan.id,
      semana_iso,
      menu: menuEnriquecido as GenerateMealPlanResponse['menu'],
      advertencias,
      explicacion_aprendizaje: explicacionAprendizaje,
    }

    return jsonResponse(response)
  } catch (err) {
    return toErrorResponse(err, FN_NAME)
  }
})
