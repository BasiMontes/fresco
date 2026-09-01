// Deterministic 21-slot menu selection — ADR-0005. Replaces the old
// single-Gemini-call approach for filling the calendar: the SQL pre-filter
// (`get_filtered_recipes()`, FR-8.1 Layer 1) already does the safety-critical
// exclusion work (allergens, disliked ingredients, dieta flags), so this is a
// constrained-selection problem over a clean, structured candidate set — not
// a task that needs a language model's judgment. See ADR-0005 for the full
// reasoning and the trade-offs accepted.
//
// What this file guarantees BY CONSTRUCTION (never by hoping a model
// complies): no lunch/dinner repeat within the week, breakfast capped at 3
// repeats, Pro-tier history (`recentRecipeIds`) hard-excluded from the
// candidate pool (ADR-0001's invariant — Free never even reaches this
// exclusion step, since Free always passes `recentRecipeIds: []`), and a
// slot with zero real candidates gets `NO_SAFE_RECIPE_SENTINEL` with a
// real, specific advertencia — never silent (FR-8.2 / AC Scenario 4).

import type { CosteEstimado } from '../../../api/schemas/recipe.types.ts'
import type { DiaSemana, Recipe, TipoPlatoSlot, UserProfile } from './types.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const WEEKEND_DIAS = new Set<DiaSemana>(['sabado', 'domingo'])
const MAX_BREAKFAST_REPEATS = 3

// Same approximate per-recipe euro midpoints `validator.ts` used before this
// ADR — no numeric per-recipe price exists in the schema
// (`recipe.meta.coste_estimado` is a 4-value categorical enum).
const BUCKET_MIDPOINT_EUROS: Record<CosteEstimado, number> = {
  muy_bajo: 1.5,
  bajo: 3,
  medio: 5,
  alto: 8,
}

/** ASCII to match the real seeded `recipes.temporada` values (no accents live in the data — confirmed live, 2026-08-01). */
function getCurrentSeasonAscii(): string {
  const month = new Date().getMonth() // 0-11
  if (month === 11 || month === 0 || month === 1) return 'invierno'
  if (month >= 2 && month <= 4) return 'primavera'
  if (month >= 5 && month <= 7) return 'verano'
  return 'otono'
}

export interface SelectMenuParams {
  /** The SQL-filtered candidate set from `get_filtered_recipes()` — safety rules already applied. */
  candidates: Recipe[]
  /** Pro-tier last-2-weeks recipe ids to exclude (ADR-0001) — always `[]` for Free. */
  recentRecipeIds: string[]
  profile: UserProfile
  /** Pro/Family personal cocinada/descartada counts per recipe, all-time (ADR-0008) — `undefined` for Free. */
  userEngagement?: Map<string, { cocinada: number; descartada: number }>
}

export interface SelectedMenu {
  menu: Record<DiaSemana, Record<TipoPlatoSlot, string>>
  advertencias: string[]
}

interface ScoreRecipeParams {
  recipe: Recipe
  season: string
  lastCategoria: string | null
  lastContundente: boolean | null
  /** This user's personal cocinada/descartada counts for this recipe (ADR-0008) — `undefined` for Free or no history. */
  engagement?: { cocinada: number; descartada: number }
}

/**
 * Scores one candidate for the slot currently being filled. Higher is
 * better. Encodes the same "REGLAS DE CALIDAD" the old prompt asked Gemini
 * to honor as best-effort preferences (FR-2.8) — now a fixed, auditable
 * heuristic instead of a natural-language instruction.
 */
function scoreRecipe({ recipe, season, lastCategoria, lastContundente, engagement }: ScoreRecipeParams): number {
  let score = 0
  const clasificacion = recipe.clasificacion

  if (clasificacion?.categoria && clasificacion.categoria === lastCategoria) score -= 5
  if (lastContundente !== null && clasificacion?.es_contundente === lastContundente) score -= 2

  // FRESCO-375: the seeded `recipes.temporada` values are ASCII ('otono',
  // 'todo_el_ano') and do NOT match the accented `Temporada` union (see
  // getCurrentSeasonAscii above + its L36 note). Compare as plain strings —
  // reconciling the type vs the data is tracked as a separate defect.
  const temporada: string[] = recipe.temporada ?? []
  if (temporada.includes(season)) score += 3
  else if (temporada.includes('todo_el_ano')) score += 1

  score += (recipe.rating_promedio ?? 0) * 2
  score += Math.min(recipe.veces_cocinada, 10) * 0.3
  if (recipe.veces_descartada > 2) score -= 4

  // ADR-0008: personal signal, Pro/Family only — weighted higher than the
  // global nudge above, since one specific user marking a recipe is a
  // stronger signal than the aggregate across the whole userbase.
  if (engagement) {
    score += Math.min(engagement.cocinada, 5) * 1.0
    if (engagement.descartada > 0) score -= 6
  }

  // Jitter: repeat generations for an identical profile shouldn't always
  // return the exact same week — real variety across regenerations.
  score += Math.random() * 2

  return score
}

// CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
export function selectMenu({ candidates, recentRecipeIds, profile, userEngagement }: SelectMenuParams): SelectedMenu {
  const excluded = new Set(recentRecipeIds)
  const pool = candidates.filter(r => !excluded.has(r.id))
  const recipeById = new Map(candidates.map(r => [r.id, r]))

  const byTipo = new Map<TipoPlatoSlot, Recipe[]>(
    TIPOS.map(tipo => [tipo, pool.filter(r => r.clasificacion?.tipo_plato === tipo)]),
  )

  const season = getCurrentSeasonAscii()
  const usedLunchDinner = new Set<string>()
  const breakfastCount = new Map<string, number>()
  const warnedTimeRelax = new Set<string>() // dedupes the "no recipes under N min" advertencia per (tipo, weekday/weekend)
  const warnedNoCandidates = new Set<TipoPlatoSlot>() // dedupes the empty-slot advertencia per tipo (A4-M3)
  const menu = {} as Record<DiaSemana, Record<TipoPlatoSlot, string>>
  const advertencias: string[] = []
  let lastCategoria: string | null = null
  let lastContundente: boolean | null = null

  for (const dia of DIAS) {
    menu[dia] = {} as Record<TipoPlatoSlot, string>
    const isWeekend = WEEKEND_DIAS.has(dia)
    const timeLimit = isWeekend ? profile.tiempo_max_finde_min : profile.tiempo_max_semana_min

    for (const tipo of TIPOS) {
      // FRESCO-199: the user's own choice, not a candidate-pool problem --
      // skip the whole selection/scoring pass, no advertencia.
      if (!profile.planning_selection[dia]?.includes(tipo)) {
        menu[dia][tipo] = SLOT_EXCLUDED_SENTINEL
        continue
      }

      const basePool = byTipo.get(tipo) ?? []

      const available = basePool.filter((r) => {
        if (tipo === 'desayuno') return (breakfastCount.get(r.id) ?? 0) < MAX_BREAKFAST_REPEATS
        return !usedLunchDinner.has(r.id)
      })

      if (available.length === 0) {
        menu[dia][tipo] = NO_SAFE_RECIPE_SENTINEL
        // A4-M3: distinguish a real food-safety dead end (no recipe of this
        // tipo is compatible with the user's allergies/diet at all) from a
        // variety dead end (compatible recipes exist but were all already
        // placed earlier in the week and lunch/dinner never repeat). The
        // former is a trust-and-safety signal; the latter is not — reusing
        // safety language for it erodes the safety message.
        if (!warnedNoCandidates.has(tipo)) {
          warnedNoCandidates.add(tipo)
          advertencias.push(
            basePool.length === 0
              ? `No hay ninguna receta de ${tipo} compatible con tus alergias y tu dieta. Revisa tus restricciones o añade recetas propias.`
              : `Se agotaron las recetas de ${tipo} distintas para llenar la semana sin repetir plato; algún día se ha quedado sin ${tipo} asignado.`,
          )
        }
        continue
      }

      let timeFiltered = available.filter(r => (r.meta?.tiempo_total_min ?? 0) <= timeLimit)
      const timeRelaxed = timeFiltered.length === 0
      if (timeRelaxed) timeFiltered = available

      let chosen = timeFiltered[0]
      let bestScore = -Infinity
      for (const recipe of timeFiltered) {
        const score = scoreRecipe({ recipe, season, lastCategoria, lastContundente, engagement: userEngagement?.get(recipe.id) })
        if (score > bestScore) {
          bestScore = score
          chosen = recipe
        }
      }

      menu[dia][tipo] = chosen.id
      lastCategoria = chosen.clasificacion?.categoria ?? null
      lastContundente = chosen.clasificacion?.es_contundente ?? null

      if (tipo === 'desayuno') {
        breakfastCount.set(chosen.id, (breakfastCount.get(chosen.id) ?? 0) + 1)
      }
      else {
        usedLunchDinner.add(chosen.id)
      }

      if (timeRelaxed) {
        const relaxKey = `${tipo}:${isWeekend}`
        if (!warnedTimeRelax.has(relaxKey)) {
          warnedTimeRelax.add(relaxKey)
          const periodo = isWeekend ? 'de fin de semana' : 'entre semana'
          advertencias.push(
            `No hay recetas de ${tipo} con un tiempo de preparación igual o inferior a los ${timeLimit} minutos ${periodo}; se seleccionaron las opciones disponibles más rápidas.`,
          )
        }
      }
    }
  }

  // AC Scenario 2/5: structural budget check, soft-warn only (Decision 1 —
  // never a hard-fail/retry gate, same as before this ADR).
  if (profile.presupuesto_semana_euros != null) {
    let totalEuros = 0
    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        const recipeId = menu[dia][tipo]
        if (recipeId === NO_SAFE_RECIPE_SENTINEL || recipeId === SLOT_EXCLUDED_SENTINEL) continue
        const coste = recipeById.get(recipeId)?.meta?.coste_estimado
        if (coste) totalEuros += BUCKET_MIDPOINT_EUROS[coste]
      }
    }
    if (totalEuros > profile.presupuesto_semana_euros) {
      const overage = totalEuros - profile.presupuesto_semana_euros
      advertencias.push(`El menú supera tu presupuesto semanal en aproximadamente ${overage.toFixed(2)}€`)
    }
  }

  return { menu, advertencias }
}
