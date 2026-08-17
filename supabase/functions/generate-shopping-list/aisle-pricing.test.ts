import type { IngredienteConsolidado } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { classifyShoppingList } from './aisle-pricing.ts'

/** Minimal valid IngredienteConsolidado fixture — already-summed shopping-list line. */
function makeIngrediente(overrides: Partial<IngredienteConsolidado> = {}): IngredienteConsolidado {
  return { nombre: 'tomate', cantidad: 300, unidad: 'g', usos: [], ...overrides }
}

describe('classifyShoppingList (FR-4.2/4.3 — deterministic, no Gemini call)', () => {
  test('classifies known ingredients into their real INGREDIENT_AISLE pasillo', () => {
    const result = classifyShoppingList([
      makeIngrediente({ nombre: 'tomate' }), // vegetable
      makeIngrediente({ nombre: 'pollo', cantidad: 1000, unidad: 'g' }), // protein
      makeIngrediente({ nombre: 'queso', cantidad: 200, unidad: 'g' }), // dairy
      makeIngrediente({ nombre: 'arroz', cantidad: 250, unidad: 'g' }), // pantry
    ])

    const pasilloOf = (nombre: string) =>
      result.pasillos.find(p => p.items.some(i => i.nombre === nombre))?.nombre

    expect(pasilloOf('tomate')).toBe('Frutas y verduras')
    expect(pasilloOf('pollo')).toBe('Carnes y aves')
    expect(pasilloOf('queso')).toBe('Lácteos y huevos')
    expect(pasilloOf('arroz')).toBe('Pasta/arroz/legumbres')
  })

  test('falls back to "Otros" for an ingredient with no aisle-map entry', () => {
    const result = classifyShoppingList([makeIngrediente({ nombre: 'ingrediente inventado' })])

    expect(result.pasillos).toHaveLength(1)
    expect(result.pasillos[0].nombre).toBe('Otros')
  })

  test('omits pasillos with zero items from the output array instead of returning them empty', () => {
    const result = classifyShoppingList([makeIngrediente({ nombre: 'tomate' })])

    // Only 'Frutas y verduras' has items — the other 12 fixed PASILLOS must not appear.
    expect(result.pasillos).toHaveLength(1)
    expect(result.pasillos.map(p => p.nombre)).toEqual(['Frutas y verduras'])
  })

  test('sorts items alphabetically within a pasillo', () => {
    const result = classifyShoppingList([
      makeIngrediente({ nombre: 'zanahoria', cantidad: 2, unidad: 'unidades' }),
      makeIngrediente({ nombre: 'ajo', cantidad: 3, unidad: 'dientes' }),
      makeIngrediente({ nombre: 'manzana', cantidad: 2, unidad: 'unidades' }),
    ])

    const frutasYVerduras = result.pasillos.find(p => p.nombre === 'Frutas y verduras')!
    expect(frutasYVerduras.items.map(i => i.nombre)).toEqual(['ajo', 'manzana', 'zanahoria'])
  })

  // Regression test for the real bug fixed this session: PRICE_OVERRIDE entries
  // for high-value ingredients (salmon, jamon iberico, etc.) were originally
  // flat per-instance prices assuming a 1-unit default. Once consolidator.ts
  // started returning real gram quantities (400-1000g), that flat price got
  // multiplied by grams as if it were a per-gram price, blowing the total up
  // to 3213-4347 EUR for 37 items instead of ~70-100 EUR. A realistic mixed
  // list (several high-value gram-quantity proteins + everyday low-value
  // items) must land in a sane EUR range, not the thousands.
  test('estimates a sane total cost for a realistic multi-ingredient list with high-value gram quantities', () => {
    const result = classifyShoppingList([
      // High-value proteins priced per gram — the exact class that regressed.
      makeIngrediente({ nombre: 'salmon', cantidad: 400, unidad: 'g' }),
      makeIngrediente({ nombre: 'jamon iberico', cantidad: 100, unidad: 'g' }),
      makeIngrediente({ nombre: 'queso parmesano', cantidad: 80, unidad: 'g' }),
      makeIngrediente({ nombre: 'ternera', cantidad: 500, unidad: 'g' }),
      makeIngrediente({ nombre: 'pollo', cantidad: 1000, unidad: 'g' }),
      makeIngrediente({ nombre: 'cordero', cantidad: 600, unidad: 'g' }),
      // Everyday low-value items rounding out a normal shopping list.
      makeIngrediente({ nombre: 'tomate', cantidad: 300, unidad: 'g' }),
      makeIngrediente({ nombre: 'cebolla', cantidad: 1, unidad: 'unidades' }),
      makeIngrediente({ nombre: 'ajo', cantidad: 3, unidad: 'dientes' }),
      makeIngrediente({ nombre: 'arroz', cantidad: 250, unidad: 'g' }),
      makeIngrediente({ nombre: 'pasta', cantidad: 300, unidad: 'g' }),
      makeIngrediente({ nombre: 'leche', cantidad: 500, unidad: 'ml' }),
      makeIngrediente({ nombre: 'huevo', cantidad: 4, unidad: 'unidades' }),
      makeIngrediente({ nombre: 'pan', cantidad: 4, unidad: 'rebanadas' }),
      makeIngrediente({ nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml' }),
      makeIngrediente({ nombre: 'sal', cantidad: 5, unidad: 'g' }),
    ])

    expect(result.resumen.total_items).toBe(16)
    // Real math lands ~32-44 EUR; the flat-price-times-grams bug produced
    // thousands, so these bounds are tight enough to catch a reintroduction.
    expect(result.resumen.coste_estimado_min).toBeGreaterThan(15)
    expect(result.resumen.coste_estimado_max).toBeLessThan(100)
  })
})
