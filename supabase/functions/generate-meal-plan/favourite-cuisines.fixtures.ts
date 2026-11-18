// FRESCO-1226: shared fixtures for the favourite-cuisines tests and the golden-menu generator.
import type { DiaSemana, Recipe, Temporada, TipoPlatoSlot, UserProfile } from './types.ts'
import type { SelectMenuParams } from './menu-selector.ts'

export const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
export const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']
export const FECHA_INICIO = '2026-01-05'
export const ALL_SLOTS = Object.fromEntries(DIAS.map(dia => [dia, TIPOS])) as Record<DiaSemana, TipoPlatoSlot[]>

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
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

export function makeRecipe(id: string, tipo: TipoPlatoSlot, cocina: string, overrides: Partial<Recipe> = {}): Recipe {
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
export function buildRealisticPool(perTipo = 120): Recipe[] {
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

export const SEEDS = Array.from({ length: 20 }, (_, i) => `user-${i}:2026-W0${(i % 9) + 1}`)


/** Fixed inputs for the golden menus: a plain Free profile and a constrained one (time, budget, history, engagement). */
export function goldenCases(): { name: string, params: SelectMenuParams }[] {
  const candidates = buildRealisticPool()
  const recent = candidates.filter((_, i) => i % 9 === 0).map(r => r.id)
  const engagement = new Map(candidates.filter((_, i) => i % 13 === 0).map((r, i) => [r.id, { cocinada: (i % 4) + 1, descartada: i % 5 === 0 ? 1 : 0 }]))
  return SEEDS.slice(0, 6).flatMap(seed => [
    { name: `plain ${seed}`, params: { candidates, recentRecipeIds: [], seed, fechaInicio: FECHA_INICIO, profile: makeProfile() } },
    {
      name: `constrained ${seed}`,
      params: {
        candidates,
        recentRecipeIds: recent,
        repeatableRecipeIds: recent.slice(0, 5),
        seed,
        fechaInicio: '2026-07-06',
        profile: makeProfile({ tiempo_max_semana_min: 25, tiempo_max_finde_min: 45, presupuesto_semana_euros: 60 }),
        userEngagement: engagement,
      },
    },
  ])
}
