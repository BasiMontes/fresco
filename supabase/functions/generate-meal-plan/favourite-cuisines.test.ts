// FRESCO-1226: favourite cuisines as a soft preference in menu selection (Pro/Family only, FR-5.4).
import type { DiaSemana, Recipe, TipoPlatoSlot } from './types.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { cuisineKey, favouriteCuisineKeys } from './cuisine.ts'
import { ALL_SLOTS, DIAS, FECHA_INICIO, SEEDS, TIPOS, buildRealisticPool, goldenCases, makeProfile, makeRecipe } from './favourite-cuisines.fixtures.ts'
import { FAVOURITE_CUISINE_BONUS, scoreRecipe, selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

type Menu = Record<DiaSemana, Record<TipoPlatoSlot, string>>

const GOLDEN = JSON.parse(readFileSync(new URL('./favourite-cuisines.golden.json', import.meta.url), 'utf8')) as Record<string, unknown>

function placedIds(menu: Menu): string[] {
  return DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo])).filter(id => id !== NO_SAFE_RECIPE_SENTINEL && id !== SLOT_EXCLUDED_SENTINEL)
}

function countFavourite(pool: Recipe[], ids: string[], favourites: string[]): number {
  const keys = favouriteCuisineKeys(favourites)
  const byId = new Map(pool.map(r => [r.id, r]))
  return ids.filter(id => keys.has(cuisineKey(byId.get(id)?.clasificacion?.cocina))).length
}

/** Tiny seeded PRNG so the "many draws" tests are reproducible. */
function lcg(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0
    return a / 4294967296
  }
}

describe('cuisine keys', () => {
  test('fold accents and the catalog-only names onto the user vocabulary', () => {
    expect(cuisineKey('mediterránea')).toBe(cuisineKey('mediterranea'))
    expect(cuisineKey('Asiática')).toBe(cuisineKey('asiatica'))
    expect(cuisineKey('latinoamericana')).toBe(cuisineKey('latina'))
    expect(cuisineKey('casera')).not.toBe(cuisineKey('española'))
  })

  test('null, undefined and empty favourites give an empty set', () => {
    expect(favouriteCuisineKeys(null).size).toBe(0)
    expect(favouriteCuisineKeys(undefined).size).toBe(0)
    expect(favouriteCuisineKeys([]).size).toBe(0)
  })

  test('a non-array value gives an empty set instead of throwing (a throw would 500 menu generation)', () => {
    expect(favouriteCuisineKeys('italiana').size).toBe(0)
    expect(favouriteCuisineKeys({ 0: 'italiana', length: 1 }).size).toBe(0)
    expect(favouriteCuisineKeys(42).size).toBe(0)
  })

  test('non-string entries are skipped, string entries kept', () => {
    expect([...favouriteCuisineKeys(['italiana', null, 3, undefined, {}, ['x'], 'mexicana'])].sort()).toEqual(['italiana', 'mexicana'])
    expect(cuisineKey(undefined)).toBe('')
    expect(cuisineKey(7)).toBe('')
  })
})

describe('selectMenu is byte-identical to the pre-FRESCO-1226 selector (golden output generated from staging)', () => {
  const cases = goldenCases()

  test('the golden file covers every case', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(cases.map(c => c.name).sort())
  })

  test('no favourites passed: output equals the golden menu', () => {
    for (const { name, params } of cases) expect(JSON.stringify(selectMenu(params))).toBe(JSON.stringify(GOLDEN[name]))
  })

  test('empty and null favourites passed: output equals the golden menu', () => {
    for (const { name, params } of cases) {
      expect(JSON.stringify(selectMenu({ ...params, favouriteCuisines: [] }))).toBe(JSON.stringify(GOLDEN[name]))
      expect(JSON.stringify(selectMenu({ ...params, favouriteCuisines: null }))).toBe(JSON.stringify(GOLDEN[name]))
    }
  })

  test('a Free user with favourites on the profile: output equals the golden menu (the selector reads none from the profile)', () => {
    for (const { name, params } of cases) {
      const profile = { ...params.profile, plan: 'free' as const, cocinas_favoritas: ['italiana', 'mexicana'] as typeof params.profile.cocinas_favoritas }
      expect(JSON.stringify(selectMenu({ ...params, profile }))).toBe(JSON.stringify(GOLDEN[name]))
    }
  })
})

describe('selectMenu with favourite cuisines passed (Pro/Family)', () => {
  const pool = buildRealisticPool()
  const favourites = ['italiana', 'mexicana']
  const run = (seed: string, fav?: string[]) => selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile(), favouriteCuisines: fav })

  test('a favourite that matches nothing in the pool changes nothing', () => {
    const noItalian = pool.filter(r => r.clasificacion?.cocina !== 'italiana')
    const base = selectMenu({ candidates: noItalian, recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile: makeProfile() })
    const withFav = selectMenu({ candidates: noItalian, recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile: makeProfile(), favouriteCuisines: ['italiana'] })
    expect(JSON.stringify(withFav)).toBe(JSON.stringify(base))
  })

  test('same seed and same inputs give the same menu with favourites', () => {
    expect(JSON.stringify(run(SEEDS[3], favourites))).toBe(JSON.stringify(run(SEEDS[3], favourites)))
  })

  test('with a 0.5 bonus the menu holds more favourite-cuisine recipes than without, and still mixes other cuisines (20 seeds)', () => {
    expect(FAVOURITE_CUISINE_BONUS).toBe(0.5)
    let totalWithout = 0
    let totalWith = 0
    let seedsHigher = 0
    for (const seed of SEEDS) {
      const without = placedIds(run(seed).menu)
      const withFav = placedIds(run(seed, favourites).menu)
      const nWithout = countFavourite(pool, without, favourites)
      const nWith = countFavourite(pool, withFav, favourites)
      expect(nWith).toBeGreaterThanOrEqual(nWithout)
      expect(nWith).toBeLessThan(withFav.length) // never forced: other cuisines stay in the menu
      if (nWith > nWithout) seedsHigher++
      totalWithout += nWithout
      totalWith += nWith
    }
    // Measured numbers (deterministic: fixed pool, fixed seeds), kept for the DOJO write-up.
    expect(totalWithout).toBe(15)
    expect(totalWith).toBe(60)
    expect(seedsHigher).toBe(20)
  })

  test('variety is kept: no lunch or dinner repeats and breakfast stays capped at 3', () => {
    for (const seed of SEEDS) {
      const { menu } = run(seed, ['italiana'])
      const lunchDinner = DIAS.flatMap(dia => [menu[dia].comida, menu[dia].cena])
      expect(new Set(lunchDinner).size).toBe(lunchDinner.length)
      const breakfasts = DIAS.map(dia => menu[dia].desayuno)
      for (const id of new Set(breakfasts)) expect(breakfasts.filter(b => b === id).length).toBeLessThanOrEqual(3)
    }
  })
})

describe('the bonus is a tie-breaker, sized by arithmetic', () => {
  const score = (recipe: Recipe, opts: { rng?: () => number, lastCategoria?: string | null, fav?: boolean } = {}) =>
    scoreRecipe({
      recipe,
      season: 'invierno',
      lastCategoria: opts.lastCategoria ?? null,
      lastContundente: null,
      rng: opts.rng ?? (() => 0),
      favouriteCuisines: opts.fav ? new Set(['italiana']) : undefined,
    })

  test('the bonus does not exceed the jitter ceiling (0.5), so it cannot invert a gap of 1.0', () => {
    expect(FAVOURITE_CUISINE_BONUS).toBeLessThanOrEqual(0.5)
  })

  test('a favourite out of season never beats a non-favourite `todo_el_ano` recipe (gap 1.0), over many random draws', () => {
    const favOut = makeRecipe('fav', 'comida', 'italiana', { temporada: ['verano'] })
    const plain = makeRecipe('plain', 'comida', 'española', { temporada: ['todo_el_ano'] })
    const rngFav = lcg(1)
    const rngPlain = lcg(2)
    for (let i = 0; i < 5000; i++) {
      const fav = score(favOut, { rng: rngFav, fav: true })
      const non = score(plain, { rng: rngPlain })
      expect(non).toBeGreaterThan(fav)
    }
  })

  test('a favourite never overturns one personal cook (+1.0, ADR-0008), over many random draws', () => {
    const favouriteRecipe = makeRecipe('fav', 'comida', 'italiana')
    const plain = makeRecipe('plain', 'comida', 'española')
    const rngFav = lcg(3)
    const rngPlain = lcg(4)
    for (let i = 0; i < 5000; i++) {
      const fav = scoreRecipe({ recipe: favouriteRecipe, season: 'invierno', lastCategoria: null, lastContundente: null, rng: rngFav, favouriteCuisines: new Set(['italiana']) })
      const non = scoreRecipe({ recipe: plain, season: 'invierno', lastCategoria: null, lastContundente: null, rng: rngPlain, engagement: { cocinada: 1, descartada: 0 } })
      expect(non).toBeGreaterThan(fav)
    }
  })

  test('the category-repeat penalty (5) beats the bonus even at the worst jitter for it', () => {
    const favRepeat = makeRecipe('fav', 'comida', 'italiana', { clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'italiana' } as Recipe['clasificacion'] })
    const plainFresh = makeRecipe('plain', 'comida', 'española', { clasificacion: { tipo_plato: 'comida', categoria: 'sopa', cocina: 'española' } as Recipe['clasificacion'] })
    // Worst case for the penalty: the favourite draws the maximum jitter, the other the minimum.
    const fav = score(favRepeat, { lastCategoria: 'pasta', fav: true, rng: () => 0.999999 })
    const non = score(plainFresh, { lastCategoria: 'pasta', rng: () => 0 })
    expect(non).toBeGreaterThan(fav)
  })

  test('selectMenu keeps the category-repeat penalty ahead of a favourite on the next slot', () => {
    const opener = makeRecipe('opener', 'comida', 'española', { clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'española' } as Recipe['clasificacion'], veces_cocinada: 10 })
    const favRepeat = makeRecipe('fav', 'comida', 'italiana', { clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'italiana' } as Recipe['clasificacion'] })
    const other = makeRecipe('other', 'comida', 'española', { clasificacion: { tipo_plato: 'comida', categoria: 'sopa', cocina: 'española' } as Recipe['clasificacion'] })
    const profile = makeProfile({ planning_selection: { ...ALL_SLOTS, lunes: ['comida'], martes: ['comida'], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] } })
    const { menu } = selectMenu({ candidates: [opener, favRepeat, other], recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile, favouriteCuisines: ['italiana'] })
    expect(menu.lunes.comida).toBe('opener')
    expect(menu.martes.comida).toBe('other')
  })
})

describe('allergens and diets stay upstream of cuisine (structure of the code, not a behavioural run against the database)', () => {
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

  test('the function body never mentions cuisine, so a favourite cannot relax a filter', () => {
    expect(body).not.toMatch(/cocina/i)
  })

  test('the selector and the cuisine helper never read allergen, diet or disliked-ingredient fields', () => {
    for (const file of ['menu-selector.ts', 'cuisine.ts']) {
      const code = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
        .split('\n')
        .filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line))
        .join('\n')
      expect(code).not.toMatch(/alergenos|dieta_|\.dieta\b|ingredientes_odiados/)
    }
  })
})
