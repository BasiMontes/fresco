import type { DiaSemana, Recipe, TipoPlatoSlot, UserProfile } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { selectMenu } from './menu-selector.ts'
import { NO_SAFE_RECIPE_SENTINEL, SLOT_EXCLUDED_SENTINEL } from './types.ts'

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const TIPOS: TipoPlatoSlot[] = ['desayuno', 'comida', 'cena']

const ALL_DAYS_ALL_MEALS: Record<DiaSemana, TipoPlatoSlot[]> = Object.fromEntries(
  DIAS.map(dia => [dia, TIPOS]),
) as Record<DiaSemana, TipoPlatoSlot[]>

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    planning_selection: ALL_DAYS_ALL_MEALS,
    created_at: '',
    updated_at: '',
    plan: 'free',
    plan_expires_at: null,
    num_personas: 2,
    adultos: 2,
    ninos: 0,
    dieta_vegetariano: false,
    dieta_vegano: false,
    dieta_sin_gluten: false,
    dieta_sin_lactosa: false,
    dieta_sin_huevo: false,
    dieta_keto: false,
    dieta_halal: false,
    alergenos: [],
    ingredientes_odiados: [],
    ingredientes_favoritos: [],
    cocinas_favoritas: [],
    nivel_picante: 'medio',
    contundencia_preferida: 'media',
    tiempo_max_semana_min: 30,
    tiempo_max_finde_min: 60,
    presupuesto_semana_euros: null,
    ...overrides,
  }
}

function makeRecipe(id: string, tipoPlato: TipoPlatoSlot, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    created_at: '',
    updated_at: '',
    nombre: `Receta ${id}`,
    slug: id,
    descripcion_corta: null,
    meta: { tiempo_prep_min: 10, tiempo_coccion_min: 10, tiempo_total_min: 20, raciones: 2, coste_estimado: 'bajo', dificultad: 'facil' },
    clasificacion: { tipo_plato: tipoPlato, categoria: 'guiso', cocina: 'española', es_contundente: false, es_ligero: true, es_comfort_food: false, apto_tupper: true, apto_congelar: false },
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: ['todo_el_ano'],
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  }
}

/** A generous, varied catalog — enough real candidates per tipo_plato that no slot needs the sentinel. */
function buildAmpleCatalog(): Recipe[] {
  const recipes: Recipe[] = []
  for (const tipo of TIPOS) {
    for (let i = 0; i < 30; i++) {
      recipes.push(makeRecipe(`${tipo}-${i}`, tipo))
    }
  }
  return recipes
}

describe('selectMenu — structural guarantees (ADR-0005)', () => {
  test('fills all 21 slots from an ample catalog, none as the sentinel', () => {
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], profile: makeProfile() })

    for (const dia of DIAS) {
      for (const tipo of TIPOS) {
        expect(menu[dia][tipo]).not.toBe(NO_SAFE_RECIPE_SENTINEL)
      }
    }
  })

  test('never repeats a comida or cena recipe within the same week', () => {
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], profile: makeProfile() })

    const comidaIds = DIAS.map(dia => menu[dia].comida)
    const cenaIds = DIAS.map(dia => menu[dia].cena)
    expect(new Set(comidaIds).size).toBe(comidaIds.length)
    expect(new Set(cenaIds).size).toBe(cenaIds.length)
  })

  test('never repeats a desayuno recipe more than 3 times in the week', () => {
    // A scarce breakfast pool (only 2 distinct recipes for 7 slots) forces
    // real repeats — proves the cap holds under pressure, not just when
    // there's enough variety to never need to repeat at all.
    const candidates = [
      makeRecipe('desayuno-a', 'desayuno'),
      makeRecipe('desayuno-b', 'desayuno'),
      ...buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato !== 'desayuno'),
    ]
    const { menu } = selectMenu({ candidates, recentRecipeIds: [], profile: makeProfile() })

    const counts = new Map<string, number>()
    for (const dia of DIAS) {
      const id = menu[dia].desayuno
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(3)
    }
  })

  test('Pro-tier recentRecipeIds are hard-excluded from every slot (ADR-0001 invariant, enforced here not by prompt instruction)', () => {
    const catalog = buildAmpleCatalog()
    const recentRecipeIds = catalog.filter(r => r.clasificacion?.tipo_plato === 'cena').slice(0, 25).map(r => r.id)

    const { menu } = selectMenu({ candidates: catalog, recentRecipeIds, profile: makeProfile({ plan: 'pro' }) })

    const chosenCenaIds = DIAS.map(dia => menu[dia].cena)
    for (const id of chosenCenaIds) {
      expect(recentRecipeIds).not.toContain(id)
    }
  })

  test('a tipo_plato with zero real candidates gets the sentinel with a specific, non-silent advertencia', () => {
    const candidates = buildAmpleCatalog().filter(r => r.clasificacion?.tipo_plato !== 'cena')
    const { menu, advertencias } = selectMenu({ candidates, recentRecipeIds: [], profile: makeProfile() })

    for (const dia of DIAS) {
      expect(menu[dia].cena).toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    expect(advertencias.some(a => a.includes('cena') && a.includes('lunes'))).toBe(true)
  })

  test('relaxes the time limit (never drops the slot) when no candidate fits, with one deduped advertencia', () => {
    const candidates = buildAmpleCatalog().map(r =>
      r.clasificacion?.tipo_plato === 'comida'
        ? { ...r, meta: { ...r.meta!, tiempo_total_min: 999 } }
        : r,
    )
    const { menu, advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [],
      profile: makeProfile({ tiempo_max_semana_min: 15, tiempo_max_finde_min: 15 }),
    })

    for (const dia of DIAS) {
      expect(menu[dia].comida).not.toBe(NO_SAFE_RECIPE_SENTINEL)
    }
    const relaxWarnings = advertencias.filter(a => a.includes('comida') && a.includes('tiempo de preparación'))
    // One for weekday, one for weekend (different time-limit buckets) — never one per day.
    expect(relaxWarnings.length).toBeLessThanOrEqual(2)
    expect(relaxWarnings.length).toBeGreaterThan(0)
  })

  test('warns when the selected menu exceeds the declared weekly budget (soft warn, never blocks)', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const { advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [],
      profile: makeProfile({ presupuesto_semana_euros: 10 }),
    })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(true)
  })

  test('presupuesto_semana_euros: null never triggers the budget check', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const { advertencias } = selectMenu({
      candidates,
      recentRecipeIds: [],
      profile: makeProfile({ presupuesto_semana_euros: null }),
    })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(false)
  })
})

describe('selectMenu — planning_selection exclusions (FRESCO-199)', () => {
  test('a day+meal excluded from planning_selection becomes the excluded sentinel, not the unsafe-recipe one', () => {
    const profile = makeProfile({
      planning_selection: { ...ALL_DAYS_ALL_MEALS, martes: ['desayuno', 'cena'] },
    })
    const { menu } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], profile })

    expect(menu.martes.comida).toBe(SLOT_EXCLUDED_SENTINEL)
    expect(menu.martes.desayuno).not.toBe(SLOT_EXCLUDED_SENTINEL)
    expect(menu.martes.cena).not.toBe(SLOT_EXCLUDED_SENTINEL)
  })

  test('an excluded slot raises no advertencia — it is the user\'s choice, not a gap', () => {
    const profile = makeProfile({
      planning_selection: { ...ALL_DAYS_ALL_MEALS, martes: ['desayuno', 'cena'] },
    })
    const { advertencias } = selectMenu({ candidates: buildAmpleCatalog(), recentRecipeIds: [], profile })

    expect(advertencias).toEqual([])
  })

  test('an excluded slot does not count toward the weekly budget check', () => {
    const candidates = buildAmpleCatalog().map(r => ({
      ...r,
      meta: { ...r.meta!, coste_estimado: 'alto' as const },
    }))
    const allExcludedProfile = makeProfile({
      planning_selection: Object.fromEntries(DIAS.map(dia => [dia, []])) as Record<DiaSemana, TipoPlatoSlot[]>,
      presupuesto_semana_euros: 1,
    })
    const { advertencias } = selectMenu({ candidates, recentRecipeIds: [], profile: allExcludedProfile })

    expect(advertencias.some(a => a.includes('supera tu presupuesto'))).toBe(false)
  })
})
