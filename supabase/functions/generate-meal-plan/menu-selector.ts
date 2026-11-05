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
// repeats, Pro-tier history (`recentRecipeIds`) excluded from the
// candidate pool (ADR-0001's invariant — Free never even reaches this
// exclusion step, since Free always passes `recentRecipeIds: []`); only when
// that leaves a slot empty may it repeat a recipe the user cooked
// (`repeatableRecipeIds`, FRESCO-1128, never a discarded one), and a
// slot with zero real candidates gets `NO_SAFE_RECIPE_SENTINEL` with a
// real, specific advertencia — never silent (FR-8.2 / AC Scenario 4).
//
// FRESCO-380 (A4-M1): selection is genuinely deterministic. The tie-break
// jitter is a PRNG seeded by (user, semana_iso) — same profile + same week =
// same menu, every time — and its magnitude (< 0.25 effective) can only
// reorder near-equal candidates, never overturn a rating-point gap. The
// SQL pre-filter (`get_filtered_recipes`) carries a stable `ORDER BY id`
// so the candidate array itself is not a source of run-to-run variance.

import type { CosteEstimado } from '../../../api/schemas/recipe.types.ts'
import type { DiaSemana, Recipe, Temporada, TipoPlatoSlot, UserProfile } from './types.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const WEEKEND_DIAS = new Set<DiaSemana>(['sabado', 'domingo'])
const MAX_BREAKFAST_REPEATS = 3

// Same approximate euro midpoints `validator.ts` used before this ADR — no
// numeric per-recipe price exists in the schema (`recipe.meta.coste_estimado`
// is a 4-value categorical enum). FRESCO-1009 (A7-LOGIC-03): the buckets are
// PER PERSON (`.context/SRS/functional-requirements.md`: "< 2 EUR/person" ...
// "implicitly scaled by household size"), so each slot's midpoint is
// multiplied by `profile.num_personas` before it is compared with the budget.
const BUCKET_MIDPOINT_EUROS: Record<CosteEstimado, number> = {
  muy_bajo: 1.5,
  bajo: 3,
  medio: 5,
  alto: 8,
}

/**
 * Deterministic PRNG seeded from a string (xmur3 hash → mulberry32). Same
 * seed always yields the same sequence, so a given (user, semana_iso) always
 * produces the same menu. FRESCO-380 (A4-M1) — replaces `Math.random()`.
 */
function makeSeededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (h ^= h >>> 16) >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Season of the PLANNED week as a `Temporada` — the union is ASCII (FRESCO-401), matching the seeded
 * `recipes.temporada` values. FRESCO-1012 (A7-LOGIC-05): it comes from the week's Monday (`fecha_inicio`),
 * not from the server clock, so a week generated ahead across a season boundary is scored with its own
 * season and the same user + seed + week gives the same menu whatever "now" is (FRESCO-380).
 */
export function seasonOf(fechaInicio: string): Temporada {
  const month = new Date(`${fechaInicio}T00:00:00Z`).getUTCMonth() // 0-11
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
  /**
   * FRESCO-1128: the subset of `recentRecipeIds` the user COOKED (never the discarded ones). When the history
   * exclusion leaves a slot with nothing to choose from, the slot may repeat one of these instead of staying
   * empty. Omitted or `[]` keeps the old behaviour.
   */
  repeatableRecipeIds?: string[]
  profile: UserProfile
  /**
   * Tie-break seed — the caller passes `${user.id}:${semana_iso}` so the same
   * user regenerating the same week gets the same menu (FRESCO-380 / A4-M1).
   */
  seed: string
  /** Monday of the planned week, `YYYY-MM-DD` (`meal_plans.fecha_inicio`): the season is read from it. */
  fechaInicio: string
  /**
   * FRESCO-1129: today in Madrid, `YYYY-MM-DD`. The days of the planned week before it are already over, so
   * they come out as excluded slots and take no pick and no budget. Omitted keeps every day of the week.
   */
  hoy?: string
  /** Pro/Family personal cocinada/descartada counts per recipe, all-time (ADR-0008) — `undefined` for Free. */
  userEngagement?: Map<string, { cocinada: number; descartada: number }>
}

export interface SelectedMenu {
  menu: Record<DiaSemana, Record<TipoPlatoSlot, string>>
  advertencias: string[]
}

interface ScoreRecipeParams {
  recipe: Recipe
  season: Temporada
  lastCategoria: string | null
  lastContundente: boolean | null
  /** Seeded PRNG for the tie-break jitter (FRESCO-380). */
  rng: () => number
  /** This user's personal cocinada/descartada counts for this recipe (ADR-0008) — `undefined` for Free or no history. */
  engagement?: { cocinada: number; descartada: number }
}

/**
 * Scores one candidate for the slot currently being filled. Higher is
 * better. Encodes the same "REGLAS DE CALIDAD" the old prompt asked Gemini
 * to honor as best-effort preferences (FR-2.8) — now a fixed, auditable
 * heuristic instead of a natural-language instruction.
 */
function scoreRecipe({ recipe, season, lastCategoria, lastContundente, rng, engagement }: ScoreRecipeParams): number {
  let score = 0
  const clasificacion = recipe.clasificacion

  if (clasificacion?.categoria && clasificacion.categoria === lastCategoria) score -= 5
  if (lastContundente !== null && clasificacion?.es_contundente === lastContundente) score -= 2

  // FRESCO-401: `Temporada` is now ASCII (matches the seeded data), so this
  // compares against the type — the `string[]` workaround from FRESCO-375 is gone.
  const temporada = recipe.temporada ?? []
  if (temporada.includes(season)) score += 3
  else if (temporada.includes('todo_el_ano')) score += 1

  // FRESCO-1012 (A7-LOGIC-10, ADR-0063): no rating term. Nothing ever sent a rating, so it was 0 for every
  // recipe; the personal signal below and the global cook/discard counts are what the score learns from.
  score += Math.min(recipe.veces_cocinada, 10) * 0.3
  if (recipe.veces_descartada > 2) score -= 4

  // ADR-0008: personal signal, Pro/Family only — weighted higher than the
  // global nudge above, since one specific user marking a recipe is a
  // stronger signal than the aggregate across the whole userbase.
  if (engagement) {
    score += Math.min(engagement.cocinada, 5) * 1.0
    if (engagement.descartada > 0) score -= 6
  }

  // Tie-break jitter (FRESCO-380 / A4-M1): seeded so the same (user, week)
  // is reproducible, and small enough (< 0.25 effective) that it can only
  // reorder candidates already within a point of each other — never
  // overturn the ADR-0008 personal nudge (+1.0). Was `Math.random() * 2`, which could
  // do exactly that.
  score += rng() * 0.5

  return score
}

/** The app is Spain-only: "today" is the date in Madrid, not in the server's UTC. */
export function hoyEnMadrid(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

/**
 * FRESCO-1129: the weekdays of the planned week that are strictly before `hoy`. When every day would be past
 * (a week already over) it returns none: that plan was asked for on purpose and an all-excluded plan helps
 * nobody, the same rule the shopping list follows (FRESCO-807).
 */
function pastDiasOf(fechaInicio: string, hoy: string | undefined): Set<DiaSemana> {
  if (!hoy) return new Set()
  const past = DIAS.filter((_, i) => {
    const d = new Date(`${fechaInicio}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10) < hoy
  })
  return past.length === DIAS.length ? new Set() : new Set(past)
}

// CLAUDE.md §10: 3+ params → object param, hence the single-object signature.
export function selectMenu({ candidates, recentRecipeIds, repeatableRecipeIds = [], profile, seed, fechaInicio, hoy, userEngagement }: SelectMenuParams): SelectedMenu {
  const rng = makeSeededRng(seed)
  const excluded = new Set(recentRecipeIds)
  const pool = candidates.filter(r => !excluded.has(r.id))
  const recipeById = new Map(candidates.map(r => [r.id, r]))

  const byTipo = new Map<TipoPlatoSlot, Recipe[]>(
    TIPOS.map(tipo => [tipo, pool.filter(r => r.clasificacion?.tipo_plato === tipo)]),
  )
  // FRESCO-1012 (A7-LOGIC-09): the same candidates before the Pro history exclusion. A narrow profile that
  // marks its meals diligently can empty a tipo once the last two weeks are excluded; the exclusion is a
  // preference for variety, never a reason to leave a slot empty, so those slots fall back to this list.
  const allByTipo = new Map<TipoPlatoSlot, Recipe[]>(
    TIPOS.map(tipo => [tipo, candidates.filter(r => r.clasificacion?.tipo_plato === tipo)]),
  )

  // FRESCO-1128: cooked-recently recipes, per tipo, the last resort before a slot stays empty.
  const repeatable = new Set(repeatableRecipeIds)
  const repeatByTipo = new Map<TipoPlatoSlot, Recipe[]>(
    TIPOS.map(tipo => [tipo, candidates.filter(r => repeatable.has(r.id) && r.clasificacion?.tipo_plato === tipo)]),
  )

  const pastDias = pastDiasOf(fechaInicio, hoy)
  const season = seasonOf(fechaInicio)
  const usedLunchDinner = new Set<string>()
  const breakfastCount = new Map<string, number>()
  const warnedTimeRelax = new Set<string>() // dedupes the "no recipes under N min" advertencia per (tipo, weekday/weekend)
  const warnedRepeat = new Set<TipoPlatoSlot>() // dedupes the "repeated a recent recipe" advertencia per tipo (FRESCO-1128)
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
      // FRESCO-1129: a day already over cannot be cooked or reassigned, so it takes no pick and no budget.
      if (pastDias.has(dia)) {
        menu[dia][tipo] = SLOT_EXCLUDED_SENTINEL
        continue
      }

      // FRESCO-199: the user's own choice, not a candidate-pool problem --
      // skip the whole selection/scoring pass, no advertencia.
      if (!profile.planning_selection[dia]?.includes(tipo)) {
        menu[dia][tipo] = SLOT_EXCLUDED_SENTINEL
        continue
      }

      const notRepeated = (r: Recipe) => tipo === 'desayuno'
        ? (breakfastCount.get(r.id) ?? 0) < MAX_BREAKFAST_REPEATS
        : !usedLunchDinner.has(r.id)

      // The history exclusion is hard while it leaves something to choose from (ADR-0001). When it leaves
      // NOTHING for this slot, FRESCO-1128 allows repeating a recipe the user cooked in the last two weeks
      // (never a discarded one) rather than leaving the slot empty. If that is not enough either and the
      // tipo has no history-free candidate at all, it falls back to every safe candidate. The allergy / diet
      // dead end is judged on those too: a variety preference must never be reported as "your allergies
      // leave nothing".
      const historyPool = byTipo.get(tipo) ?? []
      const allPool = allByTipo.get(tipo) ?? []
      let available = historyPool.filter(notRepeated)
      let repeatedRecent = false
      if (available.length === 0) {
        available = (repeatByTipo.get(tipo) ?? []).filter(notRepeated)
        repeatedRecent = available.length > 0
      }
      if (available.length === 0 && historyPool.length === 0) available = allPool.filter(notRepeated)

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
            allPool.length === 0
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
        const score = scoreRecipe({ recipe, season, lastCategoria, lastContundente, rng, engagement: userEngagement?.get(recipe.id) })
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

      if (repeatedRecent && !warnedRepeat.has(tipo)) {
        warnedRepeat.add(tipo)
        advertencias.push(
          `No quedaban recetas de ${tipo} que no hayas cocinado en las últimas 2 semanas; se ha repetido alguna que ya cocinaste.`,
        )
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
    let costeDesconocido = 0
    // The DB CHECK keeps it 1..10; a missing or odd value counts as one person, never zero.
    const personas = Number.isFinite(profile.num_personas) && profile.num_personas >= 1 ? profile.num_personas : 1
    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        const recipeId = menu[dia][tipo]
        if (recipeId === NO_SAFE_RECIPE_SENTINEL || recipeId === SLOT_EXCLUDED_SENTINEL) continue
        const coste = recipeById.get(recipeId)?.meta?.coste_estimado
        // A4-L10: `BUCKET_MIDPOINT_EUROS[coste]` is `undefined` for a missing
        // bucket OR a value outside the 4-key enum (bad/new data). Adding
        // that turns `totalEuros` into `NaN`, `NaN > budget` is `false`, and
        // the over-budget warning silently vanishes. Look the midpoint up
        // explicitly; count an unknown slot as the cheapest bucket (keeps the
        // total a lower bound) and surface the imprecision.
        const midpoint = coste ? BUCKET_MIDPOINT_EUROS[coste] : undefined
        if (midpoint != null) {
          totalEuros += midpoint * personas
        } else {
          totalEuros += BUCKET_MIDPOINT_EUROS.muy_bajo * personas
          costeDesconocido++
        }
      }
    }
    if (totalEuros > profile.presupuesto_semana_euros) {
      const overage = totalEuros - profile.presupuesto_semana_euros
      advertencias.push(`El menú supera tu presupuesto semanal en aproximadamente ${overage.toFixed(2)}€`)
    }
    if (costeDesconocido > 0) {
      advertencias.push(
        `El cálculo de presupuesto es aproximado: ${costeDesconocido} ${costeDesconocido === 1 ? 'receta no tiene' : 'recetas no tienen'} coste estimado.`,
      )
    }
  }

  return { menu, advertencias }
}
