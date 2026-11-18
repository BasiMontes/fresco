// FRESCO-1227: goal (`objetivo`) and cooking level (`nivel_experiencia`) as soft menu preferences (Pro/Family only, FR-5.4).
import type { DiaSemana, Recipe, TipoPlatoSlot } from './types.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { DIAS, FECHA_INICIO, SEEDS, TIPOS, goldenCases, makeProfile, makeRecipe } from './favourite-cuisines.fixtures.ts'
import { buildGoalLevelPool } from './goal-level.fixtures.ts'
import {
  buildGoalLevelContext,
  clampSoft,
  COST_ADJUSTMENT,
  goalLevelAdjustment,
  CUISINE_REPEAT_CAP,
  CUISINE_REPEAT_STEP,
  LEVEL_PENALTY,
  LIGHT_BONUS,
  perishableIngredients,
  SHARED_INGREDIENT_CAP,
  SHARED_INGREDIENT_STEP,
  SOFT_CAP,
} from './goal-level.ts'
import { scoreRecipe, selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

type Menu = Record<DiaSemana, Record<TipoPlatoSlot, string>>

// Generated from the selector as it stands on the FRESCO-1226 branch (before any FRESCO-1227 change): the plain
// and constrained Free cases, each also with favourite cuisines.
const GOLDEN = JSON.parse(readFileSync(new URL('./goal-level.golden.json', import.meta.url), 'utf8')) as Record<string, unknown>

const pool = buildGoalLevelPool()
const byId = new Map(pool.map(r => [r.id, r]))
const run = (seed: string, extra: Record<string, unknown> = {}) =>
  selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile(), ...extra })

function placed(menu: Menu): Recipe[] {
  return DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo])).filter(id => byId.has(id)).map(id => byId.get(id)!)
}

/** Sums a metric over the 20 seeds and counts the seeds where the option raised it and where it lowered it. */
function measure(extra: Record<string, unknown>, metric: (recipes: Recipe[]) => number) {
  let without = 0
  let withOption = 0
  let seedsHigher = 0
  let seedsLower = 0
  for (const seed of SEEDS) {
    const before = metric(placed(run(seed).menu))
    const after = metric(placed(run(seed, extra).menu))
    without += before
    withOption += after
    if (after > before) seedsHigher++
    if (after < before) seedsLower++
  }
  return { without, withOption, seedsHigher, seedsLower }
}

const countBy = (predicate: (r: Recipe) => boolean) => (recipes: Recipe[]) => recipes.filter(predicate).length
const cuisineConcentration = (recipes: Recipe[]) => {
  const counts = new Map<string, number>()
  for (const r of recipes) counts.set(r.clasificacion!.cocina, (counts.get(r.clasificacion!.cocina) ?? 0) + 1)
  return [...counts.values()].reduce((sum, n) => sum + n * n, 0)
}
const sharedIngredientReuse = (recipes: Recipe[]) => {
  const counts = new Map<string, number>()
  for (const r of recipes) for (const i of perishableIngredients(r)) counts.set(i, (counts.get(i) ?? 0) + 1)
  return [...counts.values()].reduce((sum, n) => sum + (n - 1), 0)
}
const distinctPerishables = (recipes: Recipe[]) => new Set(recipes.flatMap(r => [...perishableIngredients(r)])).size

function lcg(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0
    return a / 4294967296
  }
}

describe('Free and empty values leave the menu byte-identical (golden generated from the FRESCO-1226 selector)', () => {
  const cases = goldenCases()

  test('the golden file covers every case, with and without favourite cuisines', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(cases.flatMap(c => [c.name, `favourites ${c.name}`]).sort())
  })

  test('nothing passed: output equals the golden menu', () => {
    for (const { name, params } of cases) expect(JSON.stringify(selectMenu(params))).toBe(JSON.stringify(GOLDEN[name]))
  })

  test('favourite cuisines only: output equals the FRESCO-1226 golden menu (the new terms add nothing)', () => {
    for (const { name, params } of cases) {
      expect(JSON.stringify(selectMenu({ ...params, favouriteCuisines: ['italiana', 'mexicana'] }))).toBe(JSON.stringify(GOLDEN[`favourites ${name}`]))
    }
  })

  test('null and undefined goal and level: output equals the golden menu', () => {
    for (const { name, params } of cases) {
      expect(JSON.stringify(selectMenu({ ...params, objetivo: null, nivelExperiencia: null }))).toBe(JSON.stringify(GOLDEN[name]))
      expect(JSON.stringify(selectMenu({ ...params, objetivo: undefined, nivelExperiencia: undefined }))).toBe(JSON.stringify(GOLDEN[name]))
    }
  })

  test('a Free user whose profile carries a goal and a level: the selector reads none from the profile', () => {
    for (const { name, params } of cases) {
      const profile = { ...params.profile, plan: 'free' as const, objetivo: 'ahorrar_dinero', nivel_experiencia: 'aprendiz' } as typeof params.profile
      expect(JSON.stringify(selectMenu({ ...params, profile }))).toBe(JSON.stringify(GOLDEN[name]))
    }
  })

  test('goals and levels with no effect change nothing: perder_peso, ganar_masa_muscular, intermedio, chef, experto, unknown values', () => {
    for (const { name, params } of cases) {
      for (const objetivo of ['perder_peso', 'ganar_masa_muscular', 'no-existe', 7, {}]) {
        expect(JSON.stringify(selectMenu({ ...params, objetivo: objetivo as never }))).toBe(JSON.stringify(GOLDEN[name]))
      }
      for (const nivelExperiencia of ['intermedio', 'chef', 'experto', 'no-existe', 7, {}]) {
        expect(JSON.stringify(selectMenu({ ...params, nivelExperiencia: nivelExperiencia as never }))).toBe(JSON.stringify(GOLDEN[name]))
      }
    }
  })

  test('on the realistic pool too, every no-effect value gives the menu of a user who passed nothing (20 seeds)', () => {
    for (const seed of SEEDS) {
      const base = JSON.stringify(run(seed))
      for (const extra of [{ objetivo: 'perder_peso' }, { objetivo: 'ganar_masa_muscular' }, { nivelExperiencia: 'intermedio' }, { nivelExperiencia: 'chef' }, { nivelExperiencia: 'experto' }]) {
        expect(JSON.stringify(run(seed, extra))).toBe(base)
      }
    }
  })
})

describe('context building', () => {
  test('no context for values that change nothing, so the selector skips the term entirely', () => {
    expect(buildGoalLevelContext(null, null)).toBeUndefined()
    expect(buildGoalLevelContext('perder_peso', 'experto')).toBeUndefined()
    expect(buildGoalLevelContext(undefined, undefined)).toBeUndefined()
    expect(buildGoalLevelContext('ahorrar_dinero', null)).toBeDefined()
    expect(buildGoalLevelContext(null, 'aprendiz')).toBeDefined()
  })

  test('odd ingredient data never throws', () => {
    const odd = makeRecipe('odd', 'comida', 'española', { ingredientes_principales: 'tomate' as never })
    expect(perishableIngredients(odd).size).toBe(0)
    expect(perishableIngredients({ ...odd, ingredientes_principales: null }).size).toBe(0)
    expect([...perishableIngredients({ ...odd, ingredientes_principales: ['Ajo', 'Tomate ', 3, '', 'Limón'] as never })].sort()).toEqual(['limon', 'tomate'])
  })
})

describe('each kept option changes the menu (realistic pool, 20 seeds, deterministic numbers pinned)', () => {
  test('ahorrar_dinero: fewer expensive recipes and more cheap ones', () => {
    const expensive = measure({ objetivo: 'ahorrar_dinero' }, countBy(r => r.meta?.coste_estimado === 'alto'))
    expect(expensive.withOption).toBeLessThan(expensive.without)
    expect(expensive.seedsHigher).toBe(0)
    expect(expensive.seedsLower).toBeGreaterThan(10)
    expect([expensive.without, expensive.withOption]).toEqual([54, 22])
    const cheap = measure({ objetivo: 'ahorrar_dinero' }, countBy(r => r.meta?.coste_estimado === 'muy_bajo' || r.meta?.coste_estimado === 'bajo'))
    expect(cheap.withOption).toBeGreaterThan(cheap.without)
    expect([cheap.without, cheap.withOption]).toEqual([288, 342])
  })

  test('comer_sano: more light recipes', () => {
    const light = measure({ objetivo: 'comer_sano' }, countBy(r => r.clasificacion?.es_ligero === true))
    expect(light.withOption).toBeGreaterThan(light.without)
    expect(light.seedsLower).toBe(0)
    expect([light.without, light.withOption]).toEqual([127, 269])
  })

  test('comer_variado: the week concentrates less on one cuisine (sum of squared per-cuisine counts)', () => {
    const concentration = measure({ objetivo: 'comer_variado' }, cuisineConcentration)
    expect(concentration.withOption).toBeLessThan(concentration.without)
    expect(concentration.seedsLower).toBeGreaterThan(concentration.seedsHigher)
    expect([concentration.without, concentration.withOption]).toEqual([1886, 1554])
  })

  test('reducir_desperdicio: more ingredients reused across the week and fewer distinct perishables to buy', () => {
    const reuse = measure({ objetivo: 'reducir_desperdicio' }, sharedIngredientReuse)
    expect(reuse.withOption).toBeGreaterThan(reuse.without)
    expect(reuse.seedsHigher).toBeGreaterThan(reuse.seedsLower)
    expect([reuse.without, reuse.withOption]).toEqual([342, 506])
    const distinct = measure({ objetivo: 'reducir_desperdicio' }, distinctPerishables)
    expect(distinct.withOption).toBeLessThan(distinct.without)
    expect([distinct.without, distinct.withOption]).toEqual([1040, 877])
  })

  test('nivel aprendiz: fewer advanced and fewer medium recipes', () => {
    const advanced = measure({ nivelExperiencia: 'aprendiz' }, countBy(r => r.meta?.dificultad === 'avanzada'))
    expect(advanced.withOption).toBeLessThan(advanced.without)
    expect(advanced.seedsLower).toBeGreaterThan(advanced.seedsHigher)
    expect([advanced.without, advanced.withOption]).toEqual([69, 31])
    const medium = measure({ nivelExperiencia: 'aprendiz' }, countBy(r => r.meta?.dificultad === 'media'))
    expect(medium.withOption).toBeLessThan(medium.without)
    expect([medium.without, medium.withOption]).toEqual([129, 54])
  })

  test('nivel novato: fewer advanced recipes', () => {
    const advanced = measure({ nivelExperiencia: 'novato' }, countBy(r => r.meta?.dificultad === 'avanzada'))
    expect(advanced.withOption).toBeLessThan(advanced.without)
    expect(advanced.seedsLower).toBeGreaterThan(advanced.seedsHigher)
    expect([advanced.without, advanced.withOption]).toEqual([69, 35])
  })

  test('never an exclusion: the same slots are filled, no lunch or dinner repeats, breakfast stays capped at 3', () => {
    const options = [{ objetivo: 'ahorrar_dinero' }, { objetivo: 'comer_sano' }, { objetivo: 'comer_variado' }, { objetivo: 'reducir_desperdicio' }, { nivelExperiencia: 'aprendiz' }, { nivelExperiencia: 'novato' }]
    for (const seed of SEEDS) {
      const base = run(seed)
      const filled = (menu: Menu) => DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo])).filter(id => id !== NO_SAFE_RECIPE_SENTINEL && id !== SLOT_EXCLUDED_SENTINEL).length
      for (const extra of options) {
        const { menu, advertencias } = run(seed, extra)
        expect(filled(menu)).toBe(filled(base.menu))
        expect(advertencias).toEqual(base.advertencias)
        const lunchDinner = DIAS.flatMap(dia => [menu[dia].comida, menu[dia].cena])
        expect(new Set(lunchDinner).size).toBe(lunchDinner.length)
        const breakfasts = DIAS.map(dia => menu[dia].desayuno)
        for (const id of new Set(breakfasts)) expect(breakfasts.filter(b => b === id).length).toBeLessThanOrEqual(3)
      }
    }
  })

  test('the same seed and inputs give the same menu (ADR-0005 determinism)', () => {
    for (const extra of [{ objetivo: 'reducir_desperdicio' }, { objetivo: 'comer_variado', nivelExperiencia: 'aprendiz' }]) {
      expect(JSON.stringify(run(SEEDS[4], extra))).toBe(JSON.stringify(run(SEEDS[4], extra)))
    }
  })

  test('goal and level combine and favourite cuisines still work with them', () => {
    const both = run(SEEDS[0], { objetivo: 'ahorrar_dinero', nivelExperiencia: 'aprendiz', favouriteCuisines: ['italiana'] })
    expect(placed(both.menu).length).toBeGreaterThan(0)
  })

  test('stacked worst case (favourite cuisines + ahorrar_dinero + aprendiz): the capped sum still leans every way', () => {
    const extra = { objetivo: 'ahorrar_dinero', nivelExperiencia: 'aprendiz', favouriteCuisines: ['italiana', 'mexicana'] }
    const favouriteCount = countBy(r => ['italiana', 'mexicana'].includes(r.clasificacion!.cocina))
    const expensive = measure(extra, countBy(r => r.meta?.coste_estimado === 'alto'))
    const advanced = measure(extra, countBy(r => r.meta?.dificultad === 'avanzada'))
    const cheap = measure(extra, countBy(r => r.meta?.coste_estimado === 'muy_bajo' || r.meta?.coste_estimado === 'bajo'))
    const favourite = measure(extra, favouriteCount)
    expect([expensive.without, expensive.withOption]).toEqual([54, 25])
    expect([advanced.without, advanced.withOption]).toEqual([69, 21])
    expect([cheap.without, cheap.withOption]).toEqual([288, 331])
    expect([favourite.without, favourite.withOption]).toEqual([15, 21])
  })

  test('stacked: favourite cuisines + reducir_desperdicio + aprendiz', () => {
    const extra = { objetivo: 'reducir_desperdicio', nivelExperiencia: 'aprendiz', favouriteCuisines: ['italiana', 'mexicana'] }
    const reuse = measure(extra, sharedIngredientReuse)
    const distinct = measure(extra, distinctPerishables)
    const favourite = measure(extra, countBy(r => ['italiana', 'mexicana'].includes(r.clasificacion!.cocina)))
    expect([reuse.without, reuse.withOption]).toEqual([342, 534])
    expect([distinct.without, distinct.withOption]).toEqual([1040, 846])
    expect([favourite.without, favourite.withOption]).toEqual([15, 50])
  })
})

const BEST_WINS_AT_GAP_1 = 2480 // of 5000 draws, deterministic

describe('the soft terms are small: the COMBINED sum is capped, sized by arithmetic', () => {
  const JITTER = 0.5 // the jitter in scoreRecipe is rng() * 0.5

  test('the cap gives a soft span of 1.0, safe for every base gap of at least 1.5 (jitter below 0.5)', () => {
    expect(SOFT_CAP).toBe(0.5)
    expect(2 * SOFT_CAP).toBe(1.0)
    expect(2 * SOFT_CAP + JITTER).toBeLessThanOrEqual(1.5)
    // the smallest penalty or step that must never be overturned: the contundente repeat and the in-season step, 2.0
    expect(2 * SOFT_CAP + JITTER).toBeLessThan(2.0)
  })

  test('clampSoft clamps both ways and leaves values inside the cap untouched', () => {
    expect(clampSoft(0.5)).toBe(0.5) // the favourite alone is exactly at the cap: favourites-only menus do not change
    expect(clampSoft(0.25)).toBe(0.25)
    expect(clampSoft(0)).toBe(0)
    expect(clampSoft(1.5)).toBe(0.5)
    expect(clampSoft(-0.75)).toBe(-0.5)
  })

  test('every single term stays within the cap on its own, so the cap only binds when terms stack', () => {
    const costs = [...COST_ADJUSTMENT.values()]
    expect(Math.max(...costs)).toBeLessThanOrEqual(SOFT_CAP)
    expect(Math.min(...costs)).toBeGreaterThanOrEqual(-SOFT_CAP)
    expect(LIGHT_BONUS).toBeLessThanOrEqual(SOFT_CAP)
    expect(CUISINE_REPEAT_STEP * CUISINE_REPEAT_CAP).toBeLessThanOrEqual(SOFT_CAP)
    expect(SHARED_INGREDIENT_STEP * SHARED_INGREDIENT_CAP).toBeLessThanOrEqual(SOFT_CAP)
    for (const penalties of LEVEL_PENALTY.values()) expect(Math.max(...penalties.values())).toBeLessThanOrEqual(SOFT_CAP)
  })

  const context = buildGoalLevelContext('ahorrar_dinero', 'aprendiz')!
  const favourites = new Set(['italiana'])
  const score = (recipe: Recipe, rng: () => number, extra: Partial<Parameters<typeof scoreRecipe>[0]> = {}) =>
    scoreRecipe({ recipe, season: 'invierno', lastCategoria: null, lastContundente: null, rng, goalLevel: context, favouriteCuisines: favourites, ...extra })
  const meta = (coste: string, dificultad: string) => ({ ...makeRecipe('x', 'comida', 'x').meta!, coste_estimado: coste, dificultad }) as Recipe['meta']
  // Best case for the soft terms: favourite cuisine + cheapest + easiest (soft +0.75 uncapped, +0.5 capped).
  const best = (overrides: Partial<Recipe> = {}) => makeRecipe('best', 'comida', 'italiana', { meta: meta('muy_bajo', 'muy_facil'), ...overrides })
  // Worst case: not a favourite, most expensive, hardest (soft -0.75 uncapped, -0.5 capped).
  const worst = (overrides: Partial<Recipe> = {}) => makeRecipe('worst', 'comida', 'española', { meta: meta('alto', 'avanzada'), ...overrides })

  test('all soft terms stacked (favourite + ahorrar_dinero + aprendiz) never overturn a base gap of 1.5 (5000 draws)', () => {
    // Base gap 1.5: the worst recipe has five global cooks (+1.5), the best has none.
    const rngBest = lcg(31)
    const rngWorst = lcg(32)
    for (let i = 0; i < 5000; i++) {
      const high = score(best({ temporada: ['verano'] }), rngBest)
      const low = score(worst({ temporada: ['verano'], veces_cocinada: 5 }), rngWorst)
      expect(low).toBeGreaterThan(high)
    }
  })

  test('at a base gap of exactly 1.0 the stacked best recipe CAN win: the accepted exception, with the exact observed rate', () => {
    const rngBest = lcg(41)
    const rngWorst = lcg(42)
    let bestWins = 0
    for (let i = 0; i < 5000; i++) {
      // best is out of season (0), worst is `todo_el_ano` (+1): base gap 1.0 in favour of the worst.
      const high = score(best({ temporada: ['verano'] }), rngBest)
      const low = score(worst({ temporada: ['todo_el_ano'] }), rngWorst)
      if (high > low) bestWins++
    }
    // Soft difference is exactly 1.0, so the best wins when its jitter beats the rival's: about half of the draws.
    expect(bestWins).toBe(BEST_WINS_AT_GAP_1)
  })

  test('without the cap the same stack WOULD overturn a gap of 1.5 (why the cap exists)', () => {
    expect(0.5 + 0.25 + 0.5 - (-0.25 - 0.5)).toBeGreaterThan(1.5 - JITTER) // uncapped span 2.0 against gap 1.5
    expect(2 * SOFT_CAP).toBeLessThan(1.5 - JITTER + 0.5) // capped span 1.0
  })

  test('the soft-best recipe carrying a penalty of 2.0 or more always loses to the soft-worst one without it (5000 draws each)', () => {
    const clasif = (categoria: string, cocina: string, es_contundente: boolean) => ({ tipo_plato: 'comida', categoria, cocina, es_contundente }) as Recipe['clasificacion']
    const penalties: [string, Partial<Recipe>, Partial<Parameters<typeof scoreRecipe>[0]>][] = [
      ['category repeat -5', { clasificacion: clasif('pasta', 'italiana', false) }, { lastCategoria: 'pasta' }],
      ['contundente repeat -2', { clasificacion: clasif('sopa', 'italiana', true) }, { lastContundente: true }],
      ['global discard -4', { veces_descartada: 3 }, {}],
    ]
    for (const [label, penalised, extra] of penalties) {
      const rngPenalised = lcg(51)
      const rngClean = lcg(52)
      for (let i = 0; i < 5000; i++) {
        const high = score(best({ temporada: ['todo_el_ano'], ...penalised }), rngPenalised, extra)
        const low = score(worst({ temporada: ['todo_el_ano'] }), rngClean, extra)
        expect(low, label).toBeGreaterThan(high)
      }
    }
  })

  test('in-season step (2.0): the soft-worst recipe in season always beats the soft-best one that is only `todo_el_ano` (5000 draws)', () => {
    const rngBest = lcg(71)
    const rngWorst = lcg(72)
    for (let i = 0; i < 5000; i++) {
      const high = score(best({ temporada: ['todo_el_ano'] }), rngBest)
      const low = score(worst({ temporada: ['invierno'] }), rngWorst)
      expect(low).toBeGreaterThan(high)
    }
  })

  test('odd data (prototype keys) never produces NaN', () => {
    const odd = makeRecipe('odd', 'comida', 'española', { meta: meta('constructor', '__proto__') })
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(buildGoalLevelContext(key, key)).toBeUndefined()
      const odder = makeRecipe('odder', 'comida', 'española', { meta: meta(key, key) })
      expect(Number.isFinite(score(odder, () => 0.1))).toBe(true)
    }
    expect(Number.isFinite(score(odd, () => 0.1))).toBe(true)
    expect(goalLevelAdjustment(odd, buildGoalLevelContext('ahorrar_dinero', 'aprendiz')!)).toBe(0)
  })

  test('the new terms never draw from the rng, so the order of draws is unchanged', () => {
    let draws = 0
    const counting = () => { draws++; return 0 }
    scoreRecipe({ recipe: best(), season: 'invierno', lastCategoria: null, lastContundente: null, rng: counting, goalLevel: buildGoalLevelContext('reducir_desperdicio', 'aprendiz'), favouriteCuisines: favourites })
    expect(draws).toBe(1)
    const source = readFileSync(new URL('./goal-level.ts', import.meta.url), 'utf8').split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
    expect(source).not.toMatch(/rng|Math\.random/)
  })
})

describe('only Pro/Family reach the selector with a goal or a level (structure of index.ts)', () => {
  const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

  test('index.ts passes objetivo and nivelExperiencia only behind the isPro gate', () => {
    expect(index).toMatch(/objetivo:\s*isPro\s*\?\s*profile\.objetivo\s*:\s*undefined/)
    expect(index).toMatch(/nivelExperiencia:\s*isPro\s*\?\s*profile\.nivel_experiencia\s*:\s*undefined/)
    expect(index.match(/profile\.objetivo/g)?.length).toBe(1)
    expect(index.match(/profile\.nivel_experiencia/g)?.length).toBe(1)
  })

  test('the selector never reads the goal or the level from the profile', () => {
    const code = readFileSync(new URL('./menu-selector.ts', import.meta.url), 'utf8').split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
    expect(code).not.toMatch(/profile\.objetivo|profile\.nivel_experiencia/)
  })
})

describe('allergens and diets stay upstream of goal and level (structure of the code, not a behavioural run against the database)', () => {
  // The NEWEST migration that defines the function (a line starting with `create or replace function ...`;
  // a mention in a comment does not count), sliced to that function's own body.
  const migrationsDir = new URL('../../migrations/', import.meta.url)
  const definition = /^\s*create\s+or\s+replace\s+function\s+public\.get_filtered_recipes\b/im
  const defining = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort().filter(f => definition.test(readFileSync(new URL(f, migrationsDir), 'utf8')))
  const sql = defining.length > 0 ? readFileSync(new URL(defining[defining.length - 1], migrationsDir), 'utf8') : ''
  const start = sql.search(definition)
  const ends = ['$function$;', '$$;'].map(t => sql.indexOf(t, start)).filter(i => i > start)
  const end = ends.length > 0 ? Math.min(...ends) : -1
  const body = start >= 0 && end > start ? sql.slice(start, end) : ''

  test('some migration defines get_filtered_recipes', () => {
    expect(defining.length, 'no migration under supabase/migrations defines public.get_filtered_recipes').toBeGreaterThan(0)
  })

  test('get_filtered_recipes is found, scoped to its own body, and carries the allergen, diet and disliked-ingredient predicates', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    expect(body.length).toBeGreaterThan(0)
    expect(body).toMatch(/v_profile\.alergenos/)
    expect(body).toMatch(/v_profile\.dieta_vegetariano/)
    expect(body).toMatch(/v_profile\.dieta_halal/)
    expect(body).toMatch(/v_profile\.ingredientes_odiados/)
  })

  test('the function body never reads the goal or the level, so neither can relax a filter', () => {
    expect(body).not.toMatch(/objetivo|nivel_experiencia/i)
  })

  test('goal-level.ts never reads allergen, diet or disliked-ingredient fields', () => {
    const code = readFileSync(new URL('./goal-level.ts', import.meta.url), 'utf8')
      .split('\n')
      .filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n')
    expect(code).not.toMatch(/alergenos|dieta_|\.dieta\b|ingredientes_odiados/)
  })
})
