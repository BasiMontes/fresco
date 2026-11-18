// FRESCO-1226: favourite cuisines as a soft preference in menu selection.
import type { DiaSemana, Recipe, Temporada, TipoPlatoSlot, UserProfile } from './types.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { cuisineKey, favouriteCuisineKeys } from './cuisine.ts'
import { FAVOURITE_CUISINE_BONUS, selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
const FECHA_INICIO = '2026-01-05'
const ALL_SLOTS = Object.fromEntries(DIAS.map(dia => [dia, TIPOS])) as Record<DiaSemana, TipoPlatoSlot[]>

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    planning_selection: ALL_SLOTS,
    plan: 'free',
    num_personas: 2,
    alergenos: [],
    ingredientes_odiados: [],
    cocinas_favoritas: [],
    tiempo_max_semana_min: 120,
    tiempo_max_finde_min: 120,
    presupuesto_semana_euros: null,
    ...overrides,
  } as UserProfile
}

function makeRecipe(id: string, tipo: TipoPlatoSlot, cocina: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    nombre: `Receta ${id}`,
    slug: id,
    meta: { tiempo_prep_min: 10, tiempo_coccion_min: 10, tiempo_total_min: 20, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
    clasificacion: { tipo_plato: tipo, categoria: 'guiso', cocina, es_contundente: false, es_ligero: true, es_comfort_food: false, apto_tupper: true, apto_congelar: false },
    alergenos: [],
    temporada: ['todo_el_ano'],
    veces_cocinada: 0,
    veces_descartada: 0,
    ...overrides,
  } as Recipe
}

// The live catalog's `clasificacion.cocina` mix (counted from supabase/seed.sql, 1287 recipes): shares of the
// total, accent variants and the catalog-only names (`casera`, `latinoamericana`) included.
const CATALOG_CUISINE_MIX: [string, number][] = [
  ['española', 328], ['internacional', 315], ['casera', 206], ['mediterranea', 170], ['mediterránea', 94],
  ['asiática', 89], ['italiana', 31], ['mexicana', 28], ['latinoamericana', 26],
]
const CATEGORIAS = ['guiso', 'ensalada', 'sopa', 'pasta', 'arroz', 'legumbres', 'verdura', 'pescado', 'tostadas', 'bowls']
const SEASONS: Temporada[][] = [['todo_el_ano'], ['invierno', 'otono'], ['verano'], ['primavera', 'verano'], ['todo_el_ano']]

/** A deterministic pool with the live catalog's cuisine mix, spread over categories, seasons and cook counts. */
function buildRealisticPool(perTipo = 120): Recipe[] {
  const total = CATALOG_CUISINE_MIX.reduce((sum, [, n]) => sum + n, 0)
  const wheel = CATALOG_CUISINE_MIX.flatMap(([cocina, n]) => Array.from({ length: Math.round((n / total) * 100) || 1 }, () => cocina))
  const recipes: Recipe[] = []
  for (const tipo of TIPOS) {
    for (let i = 0; i < perTipo; i++) {
      recipes.push(makeRecipe(`${tipo}-${i}`, tipo, wheel[(i * 37 + tipo.length * 11) % wheel.length], {
        clasificacion: {
          tipo_plato: tipo,
          categoria: CATEGORIAS[(i * 7) % CATEGORIAS.length],
          cocina: wheel[(i * 37 + tipo.length * 11) % wheel.length],
          es_contundente: i % 3 === 0,
          es_ligero: i % 3 !== 0,
          es_comfort_food: false,
          apto_tupper: true,
          apto_congelar: false,
        },
        temporada: SEASONS[i % SEASONS.length],
        veces_cocinada: i % 5,
      }))
    }
  }
  return recipes
}

const SEEDS = Array.from({ length: 20 }, (_, i) => `user-${i}:2026-W0${(i % 9) + 1}`)

function placedIds(menu: Record<DiaSemana, Record<TipoPlatoSlot, string>>): string[] {
  return DIAS.flatMap(dia => TIPOS.map(tipo => menu[dia][tipo])).filter(id => id !== NO_SAFE_RECIPE_SENTINEL && id !== SLOT_EXCLUDED_SENTINEL)
}

function countFavourite(pool: Recipe[], ids: string[], favourites: string[]): number {
  const keys = favouriteCuisineKeys(favourites)
  const byId = new Map(pool.map(r => [r.id, r]))
  return ids.filter(id => keys.has(cuisineKey(byId.get(id)?.clasificacion?.cocina))).length
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
})

describe('selectMenu with favourite cuisines', () => {
  const pool = buildRealisticPool()

  test('empty or null cocinas_favoritas leaves the menu byte-identical to the one without the field', () => {
    for (const seed of SEEDS) {
      const base = selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile() })
      const empty = selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile({ cocinas_favoritas: [] }) })
      const nulled = selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile({ cocinas_favoritas: null as unknown as [] }) })
      expect(JSON.stringify(empty)).toBe(JSON.stringify(base))
      expect(JSON.stringify(nulled)).toBe(JSON.stringify(base))
    }
  })

  test('a favourite that matches nothing in the pool changes nothing', () => {
    const noFavouriteMatch = pool.filter(r => r.clasificacion?.cocina !== 'italiana')
    const base = selectMenu({ candidates: noFavouriteMatch, recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile: makeProfile() })
    const withFav = selectMenu({ candidates: noFavouriteMatch, recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile: makeProfile({ cocinas_favoritas: ['italiana'] }) })
    expect(JSON.stringify(withFav)).toBe(JSON.stringify(base))
  })

  test('same seed and same inputs give the same menu with favourites', () => {
    const profile = makeProfile({ cocinas_favoritas: ['italiana', 'mexicana'] })
    const a = selectMenu({ candidates: pool, recentRecipeIds: [], seed: SEEDS[3], fechaInicio: FECHA_INICIO, profile })
    const b = selectMenu({ candidates: pool, recentRecipeIds: [], seed: SEEDS[3], fechaInicio: FECHA_INICIO, profile })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  test('the menu holds strictly more favourite-cuisine recipes than without, and still mixes other cuisines', () => {
    const favourites: UserProfile['cocinas_favoritas'] = ['italiana', 'mexicana']
    const rows: string[] = []
    let totalWithout = 0
    let totalWith = 0
    for (const seed of SEEDS) {
      const without = placedIds(selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile() }).menu)
      const withFav = placedIds(selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile({ cocinas_favoritas: favourites }) }).menu)
      const nWithout = countFavourite(pool, without, favourites)
      const nWith = countFavourite(pool, withFav, favourites)
      rows.push(`${seed}: ${nWithout} -> ${nWith} of ${withFav.length}`)
      expect(nWith).toBeGreaterThan(nWithout)
      expect(nWith).toBeLessThan(withFav.length) // never forced: other cuisines stay in the menu
      totalWithout += nWithout
      totalWith += nWith
    }
    console.info(`[FRESCO-1226] bonus=${FAVOURITE_CUISINE_BONUS} favourites=${favourites.join('+')} seeds=${SEEDS.length}\n${rows.join('\n')}\nTOTAL without=${totalWithout} with=${totalWith}`)
  })

  test('variety is kept: no lunch or dinner repeats and breakfast stays capped at 3', () => {
    const profile = makeProfile({ cocinas_favoritas: ['italiana'] })
    for (const seed of SEEDS) {
      const { menu } = selectMenu({ candidates: pool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile })
      const lunchDinner = DIAS.flatMap(dia => [menu[dia].comida, menu[dia].cena])
      expect(new Set(lunchDinner).size).toBe(lunchDinner.length)
      const breakfasts = DIAS.map(dia => menu[dia].desayuno)
      for (const id of new Set(breakfasts)) expect(breakfasts.filter(b => b === id).length).toBeLessThanOrEqual(3)
    }
  })

  test('the category-repeat penalty still beats the bonus', () => {
    // Two lunches, same scores except cuisine and category: the favourite one repeats the previous category
    // (-5) so the non-favourite one must still win on the second slot.
    const favouriteSame = makeRecipe('fav', 'comida', 'italiana', { clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'italiana' } as Recipe['clasificacion'] })
    const opener = makeRecipe('opener', 'comida', 'española', { clasificacion: { tipo_plato: 'comida', categoria: 'pasta', cocina: 'española' } as Recipe['clasificacion'], veces_cocinada: 10 })
    const other = makeRecipe('other', 'comida', 'española', { clasificacion: { tipo_plato: 'comida', categoria: 'sopa', cocina: 'española' } as Recipe['clasificacion'] })
    const profile = makeProfile({ cocinas_favoritas: ['italiana'], planning_selection: { ...ALL_SLOTS, lunes: ['comida'], martes: ['comida'], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] } })
    const { menu } = selectMenu({ candidates: [opener, favouriteSame, other], recentRecipeIds: [], seed: SEEDS[0], fechaInicio: FECHA_INICIO, profile })
    expect(menu.lunes.comida).toBe('opener')
    expect(menu.martes.comida).toBe('other')
  })

  test('a recipe outside the candidate set (an allergen the SQL pre-filter removed) never enters the menu because of a favourite cuisine', () => {
    const allergenic = makeRecipe('gluten-pizza', 'comida', 'italiana', { alergenos: ['gluten'], veces_cocinada: 10 })
    const safePool = pool // the SQL pre-filter already dropped `allergenic`; it is not a candidate
    const profile = makeProfile({ alergenos: ['gluten'], cocinas_favoritas: ['italiana'] })
    for (const seed of SEEDS) {
      const { menu } = selectMenu({ candidates: safePool, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile })
      expect(placedIds(menu)).not.toContain(allergenic.id)
      const known = new Set(safePool.map(r => r.id))
      expect(placedIds(menu).every(id => known.has(id))).toBe(true)
    }
  })

  test('the SQL pre-filter does not look at cuisine, so a favourite can never relax an allergen or diet rule', () => {
    const sql = readFileSync(new URL('../../migrations/20260908180000_recipes_activo_soft_delete.sql', import.meta.url), 'utf8')
    const fn = sql.slice(sql.indexOf('function public.get_filtered_recipes'))
    expect(fn.length).toBeGreaterThan(0)
    expect(fn).not.toMatch(/cocina/i)
  })
})
