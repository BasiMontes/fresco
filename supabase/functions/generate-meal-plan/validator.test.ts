import type { Recipe } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { NO_SAFE_RECIPE_SENTINEL } from './types.ts'
import { validateMenuOutput } from './validator.ts'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const TIPOS = ['desayuno', 'comida', 'cena'] as const
const SEMANA_ISO = '2026-W05'

/** Minimal valid Recipe fixture — only `meta.coste_estimado` matters for these tests. */
function makeRecipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    created_at: '',
    updated_at: '',
    nombre: `Receta ${id}`,
    slug: id,
    descripcion_corta: null,
    meta: null,
    clasificacion: null,
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  }
}

/**
 * Builds a structurally-valid 21-slot raw menu (no hard errors: all 21 slots
 * present, valid ids, no lunch/dinner repeat) where every recipe belongs to
 * `bucket`. Returns the raw payload plus the `recipeById` map the budget
 * check needs.
 */
function buildMenu(bucket: 'muy_bajo' | 'bajo' | 'medio' | 'alto') {
  const recipeById = new Map<string, Recipe>()
  const validRecipeIds = new Set<string>()
  const menu: Record<string, Record<string, string>> = {}

  let counter = 0
  for (const dia of DIAS) {
    menu[dia] = {}
    for (const tipo of TIPOS) {
      const id = `r${counter++}`
      recipeById.set(id, makeRecipe(id, { meta: { tiempo_prep_min: 10, tiempo_coccion_min: 10, tiempo_total_min: 20, raciones: 2, coste_estimado: bucket, dificultad: 'facil' } }))
      validRecipeIds.add(id)
      menu[dia][tipo] = id
    }
  }

  return {
    raw: { semana: SEMANA_ISO, menu, advertencias: [] as string[] },
    recipeById,
    validRecipeIds,
  }
}

describe('validateMenuOutput — budget check (AC Scenario 2/5, Decision 1: soft-warn only)', () => {
  test('a menu built entirely from alto-bucket recipes against a low budget produces a specific overage warning', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('alto')

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: 50,
    })

    // 21 slots x 8€ (alto midpoint) = 168€; overage over a 50€ budget = 118.00€
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('El menú supera tu presupuesto semanal en aproximadamente 118.00€')
  })

  test('a within-budget menu produces no overage warning', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('muy_bajo')

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: 50,
    })

    // 21 slots x 1.5€ (muy_bajo midpoint) = 31.5€, well within a 50€ budget
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('supera tu presupuesto'))).toBe(false)
  })

  test('presupuesto_semana_euros: null never triggers the check, regardless of recipe cost', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('alto')

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: null,
    })

    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('supera tu presupuesto'))).toBe(false)
  })
})

describe('validateMenuOutput — NO_SAFE_RECIPE_SENTINEL (FR-8.2 / AC Scenario 4, FRESCO-23)', () => {
  test('a sentinel slot paired with a real advertencia is recorded as unsafeSlots, not a generic error', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('bajo')
    raw.menu.lunes.desayuno = NO_SAFE_RECIPE_SENTINEL
    raw.advertencias = ['No hay ninguna receta segura para el desayuno del lunes con tus restricciones declaradas.']

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: null,
    })

    expect(result.valid).toBe(false)
    expect(result.unsafeSlots).toEqual(['lunes.desayuno'])
    expect(result.errors).toEqual([])
  })

  test('a sentinel slot with NO advertencia is treated as a non-compliant, generically-retried error, not a clean unsafeSlot', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('bajo')
    raw.menu.martes.cena = NO_SAFE_RECIPE_SENTINEL
    raw.advertencias = []

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: null,
    })

    expect(result.valid).toBe(false)
    expect(result.unsafeSlots).toEqual([])
    expect(result.errors.some(e => e.includes('sin receta segura') && e.includes('advertencia'))).toBe(true)
  })

  test('multiple sentinel slots are all recorded, in order', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('bajo')
    raw.menu.lunes.desayuno = NO_SAFE_RECIPE_SENTINEL
    raw.menu.viernes.comida = NO_SAFE_RECIPE_SENTINEL
    raw.advertencias = ['Sin receta segura para desayuno del lunes.', 'Sin receta segura para comida del viernes.']

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: null,
    })

    expect(result.valid).toBe(false)
    expect(result.unsafeSlots).toEqual(['lunes.desayuno', 'viernes.comida'])
  })

  test('a sentinel slot is never counted toward the weekly budget check', () => {
    const { raw, recipeById, validRecipeIds } = buildMenu('alto')
    raw.menu.lunes.desayuno = NO_SAFE_RECIPE_SENTINEL
    raw.advertencias = ['Sin receta segura para desayuno del lunes.']

    const result = validateMenuOutput({
      raw,
      validRecipeIds,
      semanaIso: SEMANA_ISO,
      recipeById,
      presupuestoSemanaEuros: 1000, // high enough that 20x8€=160€ never overflows
    })

    expect(result.warnings.some(w => w.includes('supera tu presupuesto'))).toBe(false)
  })
})
