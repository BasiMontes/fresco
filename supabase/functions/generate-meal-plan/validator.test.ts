import type { Recipe } from './types.ts'
import { describe, expect, test } from 'bun:test'
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
    raw: { semana: SEMANA_ISO, menu, advertencias: [] },
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
