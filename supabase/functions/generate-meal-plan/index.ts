// supabase/functions/generate-meal-plan/index.ts
//
// Orchestrates FR-2.1-FR-2.10, api-contracts.md §1. Auth, DB reads/writes,
// the Free/Pro history branch, the SQL pre-filter call (FR-8.1 Layer 1), the
// retry/validation control flow, persistence with manual rollback
// compensation (NFR-REL-2), and response enrichment are real, working code.
// The actual Gemini prompt-building (Layer 2 of the food-safety guardrail,
// plus quality-rule wording) is deferred — see prompt.ts's TODOs — that is
// implementation/model-tuning detail for /sprint-development, not this
// bootstrap pass.

import { handleCorsPreflight } from '../_shared/cors.ts'
import { HttpError, jsonResponse, toErrorResponse } from '../_shared/http.ts'
import { createRequestClient } from '../_shared/supabase-client.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { callGemini } from '../_shared/gemini.ts'
import { logger } from '../_shared/logger.ts'
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts'
import { validateMenuOutput } from './validator.ts'
import type {
  DiaSemana,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  MenuSemanal,
  Recipe,
  TipoPlatoSlot,
  UserProfile,
} from './types.ts'

const FN_NAME = 'generate-meal-plan'
const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const MAX_RETRIES = 2
const MIN_CATALOG_SIZE = 21 // 7 days x 3 slots — FR-2.1

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    //
    // TODO: guest-mode auth unresolved, see business-api-map.md Discovery Gaps.
    // EPIC-FRESCO-6 needs this endpoint reachable without a Supabase Auth JWT;
    // requireAuthenticatedUser() (in _shared/auth.ts) carries the full note —
    // not resolved/invented here.
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

    // 6. Pro-only history read (FR-2.5, FR-5.4, ADR-0001). Free stays a single
    // line: recentRecipeIds is [] and the prompt never receives history at all.
    const isPro = profile.plan === 'pro' || profile.plan === 'family'
    let recentRecipeIds: string[] = []

    if (isPro) {
      const { data: recentIds } = await supabase.rpc('get_recent_recipe_ids', {
        p_user_id: user.id,
        p_weeks: 2,
      })
      recentRecipeIds = recentIds ?? []
    }

    // 7. Build prompts + call Gemini, with bounded retries (NFR-REL-1).
    // buildSystemPrompt/buildUserPrompt are TODO stubs — see prompt.ts — so
    // this loop will fail fast until /sprint-development fills them in. The
    // retry/validation shape itself is real.
    const validRecipeIds = new Set<string>(recipes.map(r => r.id))
    const recipeMap = new Map<string, Recipe>(recipes.map(r => [r.id, r]))
    let menuData: MenuSemanal | null = null
    let lastErrors: string[] = []

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt({
        profile,
        recipes,
        recentRecipeIds,
        semanaIso: semana_iso,
        isPro,
      })

      const result = await callGemini({
        systemPrompt,
        userPrompt,
        config: {
          temperature: 0.7, // some variety without losing filter coherence
          maxOutputTokens: 1024,
        },
      })

      if (!result.ok) {
        throw new HttpError(`Error de Gemini: ${result.errorText}`, 502)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(result.rawText.trim())
      } catch {
        lastErrors = [`Intento ${attempt + 1}: JSON inválido devuelto por la IA`]
        continue
      }

      const validation = validateMenuOutput({
        raw: parsed,
        validRecipeIds,
        semanaIso: semana_iso,
        recipeById: recipeMap,
        presupuestoSemanaEuros: profile.presupuesto_semana_euros,
      })

      if (validation.valid) {
        menuData = parsed as MenuSemanal
        // FR-2.10 / FR-8.2: propagate validator warnings into advertencias — never dropped
        if (validation.warnings.length > 0) {
          menuData.advertencias = [...(menuData.advertencias ?? []), ...validation.warnings]
        }
        break
      }

      lastErrors = validation.errors
      logger.warn('Menu validation failed', { fn: FN_NAME, attempt, errors: validation.errors })
    }

    if (!menuData) {
      // AC-4: distinct from a genuine upstream failure (Gemini call error,
      // thrown as 502 above) — this is "we could not assemble a valid
      // 21-slot menu given this user's constraints", the same class of
      // "understood the request, can't fulfill it" case as the 422 thrown
      // for an insufficient catalog above. Frontend narrows on this status
      // to show AC-4-specific copy; conflating it with 502 would mislead a
      // user experiencing a transient Gemini outage into thinking their
      // dietary restrictions are the problem.
      throw new HttpError(
        `La IA no generó un menú válido tras ${MAX_RETRIES + 1} intentos: ${lastErrors.join('; ')}`,
        422
      )
    }

    // 8. Persist meal_plans
    const { data: mealPlan, error: planError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        semana_iso,
        fecha_inicio,
        advertencias: menuData.advertencias ?? [],
      })
      .select('id')
      .single()

    if (planError || !mealPlan) throw new HttpError('Error guardando el plan en la BD', 500)

    // 9. Persist the 21 slots. NFR-REL-2: Supabase Edge Functions have no
    // native multi-table transaction, so a failed slot insert triggers a
    // manual compensating delete of the orphaned meal_plans row — documented
    // as a known reliability gap, not silently hidden.
    const slots = DIAS.flatMap(dia =>
      TIPOS.map(tipo => ({
        meal_plan_id: mealPlan.id,
        recipe_id: menuData!.menu[dia][tipo],
        dia,
        tipo_plato: tipo,
        estado: 'pendiente' as const,
      }))
    )

    const { error: slotsError } = await supabase.from('meal_plan_recipes').insert(slots)

    if (slotsError) {
      await supabase.from('meal_plans').delete().eq('id', mealPlan.id)
      logger.error('Slot insert failed, rolled back meal_plan', { fn: FN_NAME, mealPlanId: mealPlan.id })
      throw new HttpError('Error guardando las recetas del plan', 500)
    }

    // 10. Enrich response with full recipe objects, not bare ids
    // (`recipeMap` built earlier, before the retry loop — step 7 reuses it
    // for the budget check.)
    const menuEnriquecido = Object.fromEntries(
      DIAS.map(dia => [
        dia,
        Object.fromEntries(TIPOS.map(tipo => [tipo, recipeMap.get(menuData!.menu[dia][tipo])])),
      ])
    )

    const response: GenerateMealPlanResponse = {
      meal_plan_id: mealPlan.id,
      semana_iso,
      menu: menuEnriquecido as GenerateMealPlanResponse['menu'],
      advertencias: menuData.advertencias ?? [],
    }

    return jsonResponse(response)
  } catch (err) {
    return toErrorResponse(err, FN_NAME)
  }
})
