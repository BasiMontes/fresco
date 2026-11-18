// FRESCO-1227: the onboarding goal (`objetivo`) and cooking level (`nivel_experiencia`) as SOFT menu preferences
// (FR-5.4: "prefer, never force"). Pro/Family only: `index.ts` passes the two values only when `isPro`, so a Free
// user never builds a context here and keeps exactly the menu it had before.
//
// Every term is a small score nudge, never an exclusion, and each one has a SPAN (best value minus worst value)
// of 0.5 or less. The jitter in `scoreRecipe` is `rng() * 0.5`, so two recipes separated by a gap of 1.0 can
// already be reordered by less than 0.5 of noise; a term whose span is at most 0.5 cannot, on its own, overturn
// a gap of 1.0 or more (span + noise would have to exceed 1.0). The existing steps it leans on: in season
// (+3 / +1 / 0), a personal cook (+1.0, ADR-0008), the category repeat (-5), the contundente repeat (-2), the
// global discard (-4), the personal discard (-6) and the favourite cuisine (+0.5, FRESCO-1226). Only the global
// cook count (+0.3 per cook) has steps below the spans, and those are the "otherwise comparable recipes" these
// terms exist to lean. Stacked on ONE recipe (favourite cuisine + goal + level against a rival with none) the
// push can reach 1.5; that is the declared preference of the same user, and it is called out in the PR.
//
// Honest limits: `perder_peso` and `ganar_masa_muscular` have no data behind them (the catalog has no calories
// or protein), so they change nothing. `es_ligero` is an orientative tag, not nutrition.

import type { DificultadReceta, Recipe } from '../../../api/schemas/recipe.types.ts'
import { cuisineKey } from './cuisine.ts'

/** `ahorrar_dinero`: by `meta.coste_estimado`. Span 0.5. */
export const COST_ADJUSTMENT: Record<string, number> = { muy_bajo: 0.25, bajo: 0.1, medio: 0, alto: -0.25 }
/** `comer_sano`: bonus for `clasificacion.es_ligero`. Span 0.3. */
export const LIGHT_BONUS = 0.3
/** `comer_variado`: penalty per recipe already picked this week with the same cuisine, capped. Span 0.5. */
export const CUISINE_REPEAT_STEP = 0.1
export const CUISINE_REPEAT_CAP = 5
/** `reducir_desperdicio`: bonus per non-pantry main ingredient shared with a recipe already picked this week, capped. Span 0.45. */
export const SHARED_INGREDIENT_STEP = 0.15
export const SHARED_INGREDIENT_CAP = 3
/** `nivel_experiencia`: penalty by `meta.dificultad`. Only the two lowest levels; the rest leave the score alone. */
export const LEVEL_PENALTY: Record<string, Partial<Record<DificultadReceta, number>>> = {
  aprendiz: { avanzada: 0.5, media: 0.2 },
  novato: { avanzada: 0.3 },
}

// Long-lived pantry items: sharing them says nothing about wasted food (nobody throws away the olive oil).
const PANTRY = new Set([
  'ajo', 'cebolla', 'aceite de oliva', 'aceite', 'sal', 'pimienta', 'azucar', 'harina', 'vinagre', 'arroz', 'pasta',
  'miel', 'salsa de soja', 'avena', 'sesamo', 'comino', 'pimenton', 'oregano', 'canela', 'agua',
])

const ACTIVE_GOALS = new Set(['ahorrar_dinero', 'reducir_desperdicio', 'comer_variado', 'comer_sano'])

export interface GoalLevelContext {
  objetivo: string | null
  nivel: string | null
  /** `cuisineKey` -> recipes already picked this week. */
  cuisineCounts: Map<string, number>
  /** Normalized non-pantry ingredients of the recipes already picked this week. */
  usedIngredients: Set<string>
}

function ingredientKey(name: unknown): string {
  return typeof name === 'string' ? name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() : ''
}

/** The non-pantry main ingredients of a recipe, normalized and de-duplicated. Never throws on odd data. */
export function perishableIngredients(recipe: Recipe): Set<string> {
  const list = Array.isArray(recipe.ingredientes_principales) ? recipe.ingredientes_principales : []
  return new Set(list.map(ingredientKey).filter(key => key !== '' && !PANTRY.has(key)))
}

/**
 * The per-week context, or `undefined` when neither value changes anything (null, an unknown value, or a goal
 * without data such as `perder_peso`): the selector then skips the term entirely and its output is unchanged.
 */
export function buildGoalLevelContext(objetivo: unknown, nivel: unknown): GoalLevelContext | undefined {
  const goal = typeof objetivo === 'string' && ACTIVE_GOALS.has(objetivo) ? objetivo : null
  const level = typeof nivel === 'string' && nivel in LEVEL_PENALTY ? nivel : null
  if (goal === null && level === null) return undefined
  return { objetivo: goal, nivel: level, cuisineCounts: new Map(), usedIngredients: new Set() }
}

/** The score nudge for one candidate. Reads the context, never writes it, never draws from the rng. */
export function goalLevelAdjustment(recipe: Recipe, context: GoalLevelContext): number {
  let adjustment = 0
  switch (context.objetivo) {
    case 'ahorrar_dinero': {
      const coste = recipe.meta?.coste_estimado
      adjustment += coste ? (COST_ADJUSTMENT[coste] ?? 0) : 0
      break
    }
    case 'comer_sano':
      if (recipe.clasificacion?.es_ligero === true) adjustment += LIGHT_BONUS
      break
    case 'comer_variado': {
      const key = cuisineKey(recipe.clasificacion?.cocina)
      if (key !== '') adjustment -= CUISINE_REPEAT_STEP * Math.min(context.cuisineCounts.get(key) ?? 0, CUISINE_REPEAT_CAP)
      break
    }
    case 'reducir_desperdicio': {
      let shared = 0
      for (const ingredient of perishableIngredients(recipe)) if (context.usedIngredients.has(ingredient)) shared++
      adjustment += SHARED_INGREDIENT_STEP * Math.min(shared, SHARED_INGREDIENT_CAP)
      break
    }
  }
  if (context.nivel !== null) {
    const dificultad = recipe.meta?.dificultad
    if (dificultad) adjustment -= LEVEL_PENALTY[context.nivel]?.[dificultad] ?? 0
  }
  return adjustment
}

/** Records a picked recipe so later slots of the same week see it (variety and shared ingredients). */
export function recordGoalLevelPick(recipe: Recipe, context: GoalLevelContext): void {
  const key = cuisineKey(recipe.clasificacion?.cocina)
  if (key !== '') context.cuisineCounts.set(key, (context.cuisineCounts.get(key) ?? 0) + 1)
  for (const ingredient of perishableIngredients(recipe)) context.usedIngredients.add(ingredient)
}
