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
import { assertRateLimitAllowed } from './rate-limit.ts'
import { isProEntitlementActive } from './entitlement.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'
import type {
  DiaSemana,
  GenerateMealPlanRequest,
  GenerateMealPlanResponse,
  Recipe,
  RecentRecipeMark,
  TipoPlatoSlot,
  UserProfile,
  UserRecipeEngagementRow,
} from './types.ts'

const FN_NAME = 'generate-meal-plan'
const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const MIN_CATALOG_SIZE = 21 // 7 days x 3 slots — FR-2.1
const MAX_DESTACADAS_IN_PROMPT = 5

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  try {
    // 1. Auth (NFR-SEC-1)
    const authHeader = req.headers.get('Authorization')!
    const supabase = createRequestClient(authHeader)
    const user = await requireAuthenticatedUser(req, supabase)

    // 1.5. Rate limit (ADR-0010, FRESCO-243): 5 generations/hour per user via
    // a single atomic Postgres RPC, checked before any body parsing or DB
    // work so a rate-limited caller gets a fast 429. Never a read-then-write
    // check from here — that would race under concurrent requests from the
    // same user, which the RPC itself is designed to close.
    const { data: allowed, error: rateLimitError } = await supabase.rpc('check_and_increment_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'generate-meal-plan',
      p_limit: 5,
      p_window_seconds: 3600,
    })
    if (rateLimitError) throw new HttpError('Error verificando el límite de generación', 500)
    assertRateLimitAllowed(allowed)

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

    // 5. FR-8.1 Layer 1: SQL pre-filter by allergen/diet/disliked-ingredient.
    // FRESCO-375: the Deno client is untyped (no `Database` generic), so
    // postgrest-js infers this SETOF RPC as a single object and its type
    // guard rejects the array cast — assert the row shape at the boundary.
    const { data: recipesData, error: recipesError } = await supabase.rpc('get_filtered_recipes', {
      p_user_id: user.id,
    })
    const recipes = (recipesData ?? []) as Recipe[]

    if (recipesError || recipes.length < MIN_CATALOG_SIZE) {
      throw new HttpError(
        `Catálogo insuficiente: ${recipes.length} recetas disponibles (mínimo ${MIN_CATALOG_SIZE})`,
        422
      )
    }

    // 6. Pro-only history read (FR-2.5, FR-5.4, ADR-0001). Free stays a
    // single line: recentRecipeIds is [] and selectMenu() never excludes
    // anything for it.
    //
    // FRESCO-120: only `cocinada`/`descartada` are a real signal from the
    // user — `pendiente` (never touched) and `sustituida` are not "you
    // already had this," so they no longer get excluded. Before this fix,
    // ALL recent recipes were excluded regardless of mark, so a Pro user
    // who never marked anything got the identical no-repeat behavior as
    // one who diligently marked everything — the mechanism didn't actually
    // depend on the marks the product copy promises it learns from.
    // A4-L8: paid tier AND the entitlement has not lapsed (defence in depth
    // against a lost subscription-deleted webhook). See entitlement.ts.
    const isPro = isProEntitlementActive(profile)
    const recentRecipeIds: string[] = []
    let cocinadasEvitadas = 0
    let descartadasEvitadas = 0
    // ADR-0008: personal cocinada/descartada counts feeding scoreRecipe()'s
    // nudge — Pro/Family only, reusing this same isPro gate. Stays
    // `undefined` for Free, so scoreRecipe() applies zero personal nudge.
    let userEngagement: Map<string, { cocinada: number; descartada: number }> | undefined

    if (isPro) {
      // Independent reads (both only need user.id) — run concurrently rather
      // than paying two sequential round-trips on every Pro generation.
      const [{ data: marksData }, { data: engagementData }] = await Promise.all([
        supabase.rpc('get_recent_recipe_marks', { p_user_id: user.id, p_weeks: 2 }),
        supabase.rpc('get_user_recipe_engagement', { p_user_id: user.id }),
      ])
      // FRESCO-375: untyped Deno client — assert the row shapes at the boundary.
      const marks = (marksData ?? []) as RecentRecipeMark[]
      const engagement = (engagementData ?? []) as UserRecipeEngagementRow[]
      for (const mark of marks) {
        if (mark.estado === 'cocinada' || mark.estado === 'descartada') {
          recentRecipeIds.push(mark.recipe_id)
          if (mark.estado === 'cocinada') cocinadasEvitadas++
          else descartadasEvitadas++
        }
      }

      userEngagement = new Map(
        engagement.map(row => [
          row.recipe_id,
          { cocinada: row.veces_cocinada_usuario, descartada: row.veces_descartada_usuario },
        ]),
      )
    }

    // 7. Select the 21 slots — deterministic, synchronous, cannot itself
    // fail the way an LLM call could (ADR-0005). A slot with no safe
    // candidate becomes NO_SAFE_RECIPE_SENTINEL with a real advertencia,
    // same FR-8.2 / AC Scenario 4 contract as before.
    const recipeMap = new Map<string, Recipe>(recipes.map(r => [r.id, r]))
    const { menu, advertencias } = selectMenu({
      candidates: recipes,
      recentRecipeIds,
      profile,
      // FRESCO-380 (A4-M1): same user + same week => same menu.
      seed: `${user.id}:${semana_iso}`,
      userEngagement,
    })

    // 8. Pro learning explanation (FR-5.5) — deterministic, built from the
    // recipe stats already computed here. Cannot fail the way a Gemini call
    // could, so no try/catch needed.
    //
    // FRESCO-120: `destacadas` used to read `recipes.veces_cocinada`/
    // `rating_promedio` — aggregate columns shared across every user, not a
    // personal Pro signal. Now sourced from `get_user_cooked_recipe_ids`:
    // recipes THIS user has personally marked cocinada, so "ya te funcionó
    // bien" is actually about them.
    let explicacionAprendizaje: string | null = null
    if (isPro) {
      const { data: cookedIds } = await supabase.rpc('get_user_cooked_recipe_ids', { p_user_id: user.id })
      const personalCookedIds = new Set(cookedIds ?? [])
      const chosenIds = new Set(
        DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo]))
          .filter(id => id !== NO_SAFE_RECIPE_SENTINEL && id !== SLOT_EXCLUDED_SENTINEL),
      )
      const destacadas = [...chosenIds]
        .filter(id => personalCookedIds.has(id))
        .map(id => recipeMap.get(id))
        .filter((r): r is Recipe => r !== undefined)
        .slice(0, MAX_DESTACADAS_IN_PROMPT)

      if (destacadas.length > 0 || recentRecipeIds.length > 0) {
        explicacionAprendizaje = buildLearningExplanation({ destacadas, cocinadasEvitadas, descartadasEvitadas })
      }
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
        const isExcluded = recipeId === SLOT_EXCLUDED_SENTINEL
        const isUnsafe = recipeId === NO_SAFE_RECIPE_SENTINEL
        return {
          meal_plan_id: mealPlan.id,
          recipe_id: isExcluded || isUnsafe ? null : recipeId,
          dia,
          tipo_plato: tipo,
          // FRESCO-199: 'excluida' for the user's own choice, 'pendiente'
          // (unchanged) for everything else, including NO_SAFE_RECIPE_SENTINEL
          // -- that's still a real gap the FR-8.2 advertencia already covers.
          estado: isExcluded ? 'excluida' as const : 'pendiente' as const,
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
          const hasNoRecipe = recipeId === NO_SAFE_RECIPE_SENTINEL || recipeId === SLOT_EXCLUDED_SENTINEL
          return [tipo, hasNoRecipe ? null : recipeMap.get(recipeId) ?? null]
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

    return jsonResponse(response, { req })
  } catch (err) {
    return toErrorResponse(err, { req, fnName: FN_NAME })
  }
})
