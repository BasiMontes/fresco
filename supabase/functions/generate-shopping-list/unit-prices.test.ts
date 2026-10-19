import type { RawIngrediente } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { normalizeNombre } from '../_shared/normalize.ts'
import { classifyShoppingList, precioItem, PRICE_OVERRIDE } from './aisle-pricing.ts'
import { CATALOG_INGREDIENT_UNITS } from './catalog-units.fixture.ts'
import { consolidateIngredientes } from './consolidator.ts'

/**
 * FRESCO-1009 (audit 7b A7-LOGIC-01, A7-LOGIC-02): the price of a shopping-list line follows the
 * unit the line is in, one ingredient is one line whatever units its recipes use, and a spoon of
 * fresh herb is not 15 g.
 */

function raw(nombre: string, cantidad: number, unidad: string, overrides: Partial<RawIngrediente> = {}): RawIngrediente {
  return { nombre, cantidad, unidad, receta_id: 'r1', raciones_receta: 4, raciones_usuario: 4, receta_nombre: 'Receta', dia: 'lunes', ...overrides }
}

/** What a household would be quoted for one line, through the real consolidation and pricing. */
function priceOf(nombre: string, cantidad: number, unidad: string): number {
  const lines = consolidateIngredientes([raw(nombre, cantidad, unidad)])
  const list = classifyShoppingList(lines)
  return list.pasillos.flatMap(p => p.items).reduce((sum, item) => sum + (item.precio_estimado ?? 0), 0)
}

// A line "up to 1 kg" in each unit the catalog uses: a kilo of anything is a few euros to a few dozen,
// never hundreds. The bound is deliberately generous (jamón ibérico is 45 EUR/kg here).
const MAX_EUR_PER_LINE = 100
const ONE_KILO_LINE: Record<string, number> = {
  g: 1000, kg: 1, ml: 1000, l: 1, unidades: 4, rebanadas: 8, dientes: 6, latas: 3, botes: 1, cucharadas: 6, cucharaditas: 6,
}

describe('PRICE_OVERRIDE x unit (A7-LOGIC-01)', () => {
  const keys = Object.keys(PRICE_OVERRIDE)

  test.each(keys)('%s: a line of about a kilo in any unit stays under the bound and is never free', (nombre) => {
    for (const [unidad, cantidad] of Object.entries(ONE_KILO_LINE)) {
      const precio = precioItem(nombre, unidad, cantidad)
      expect(precio, `${nombre} ${cantidad} ${unidad}`).toBeLessThan(MAX_EUR_PER_LINE)
      expect(precio, `${nombre} ${cantidad} ${unidad}`).toBeGreaterThan(0.01)
    }
  })

  test.each([
    ['yogur', 500, 'g', 175],
    ['lechuga', 150, 'g', 135],
    ['pan', 200, 'g', 24],
    ['zanahoria', 500, 'g', 75],
  ])('the audit probe %s %d %s no longer costs %d EUR', (nombre, cantidad, unidad, before) => {
    const precio = precioItem(nombre, unidad, cantidad)

    expect(precio).toBeLessThan(5)
    expect(precio).toBeLessThan(before / 10)
  })

  test('4 tomatoes are priced as grams, not as 0.01 EUR', () => {
    // 4 x 150 g x 0.003 EUR/g
    expect(precioItem('tomate', 'unidades', 4)).toBeCloseTo(1.8, 5)
  })

  test('the same quantity costs the same in grams, kilos or pieces of the same weight', () => {
    expect(precioItem('patata', 'kg', 1)).toBeCloseTo(precioItem('patata', 'g', 1000), 5)
    expect(precioItem('yogur', 'g', 500)).toBeCloseTo(precioItem('yogur', 'unidades', 4), 5)
  })
})

describe('every (ingredient, unit) pair the catalog uses has a sane priced path (A7-LOGIC-01)', () => {
  // A realistic quantity per unit, scaled by nothing: one recipe row for one household of the recipe's size.
  const CANTIDAD: Record<string, number> = { g: 200, ml: 200, unidades: 2, cucharadas: 2, cucharaditas: 2, dientes: 3, pizca: 1, 'al gusto': 1 }

  test.each(CATALOG_INGREDIENT_UNITS.map(([nombre, unidad]) => [nombre, unidad] as const))('%s (%s)', (nombre, unidad) => {
    const precio = priceOf(nombre, CANTIDAD[unidad] ?? 1, unidad)

    expect(Number.isFinite(precio)).toBe(true)
    expect(precio).toBeGreaterThanOrEqual(0)
    expect(precio).toBeLessThan(MAX_EUR_PER_LINE)
  })

  test('the snapshot covers the units the catalog uses and nothing else sneaks into pricing', () => {
    const units = new Set(CATALOG_INGREDIENT_UNITS.map(([, unidad]) => unidad))

    expect([...units].sort()).toEqual(['al gusto', 'cucharadas', 'cucharaditas', 'dientes', 'g', 'ml', 'pizca', 'unidades'])
  })
})

describe('one line per ingredient (A7-LOGIC-02)', () => {
  test('tomate in grams and in units is one line, in grams', () => {
    const lines = consolidateIngredientes([raw('tomate', 400, 'g'), raw('tomate', 2, 'unidades', { receta_id: 'r2' })])

    expect(lines).toHaveLength(1)
    // 400 g + 2 x 150 g
    expect(lines[0]).toMatchObject({ nombre: 'tomate', cantidad: 700, unidad: 'g' })
  })

  test('zanahoria in grams and in units is one line, in pieces (rounded up)', () => {
    const lines = consolidateIngredientes([raw('zanahoria', 200, 'g'), raw('zanahoria', 3, 'unidades', { receta_id: 'r2' })])

    expect(lines).toHaveLength(1)
    // 200 g + 3 x 80 g = 440 g = 5.5 pieces of 80 g -> 6
    expect(lines[0]).toMatchObject({ cantidad: 6, unidad: 'unidades' })
  })

  test('the lines of an ingredient in grams keep their usos from both recipes', () => {
    const lines = consolidateIngredientes([
      raw('tomate', 400, 'g', { receta_nombre: 'A', dia: 'lunes' }),
      raw('tomate', 2, 'unidades', { receta_nombre: 'B', dia: 'martes' }),
    ])

    expect(lines[0].usos).toEqual([{ receta: 'A', dia: 'lunes' }, { receta: 'B', dia: 'martes' }])
  })

  test('an ingredient without a weight table keeps one line per incompatible unit instead of losing a quantity', () => {
    const lines = consolidateIngredientes([raw('ingrediente raro', 100, 'g'), raw('ingrediente raro', 2, 'unidades', { receta_id: 'r2' })])

    expect(lines).toHaveLength(2)
  })
})

describe('a spoon is not always 15 g (A7-LOGIC-02)', () => {
  test('2 cucharadas of fresh cilantro are 6 g, not 30 g', () => {
    const [line] = consolidateIngredientes([raw('cilantro', 2, 'cucharadas')])

    expect(line).toMatchObject({ cantidad: 6, unidad: 'g' })
  })

  test('1 cucharada of fresh herb is 3 g for perejil and albahaca too', () => {
    for (const nombre of ['perejil', 'albahaca']) {
      expect(consolidateIngredientes([raw(nombre, 1, 'cucharadas')])[0]).toMatchObject({ cantidad: 3, unidad: 'g' })
    }
  })

  test('a spoon of an ingredient without its own figure keeps the generic 15 g', () => {
    // miel: base g, no per-ingredient figure
    expect(consolidateIngredientes([raw('miel', 1, 'cucharadas')])[0]).toMatchObject({ cantidad: 15, unidad: 'g' })
  })

  test('the normalised catalog names match the table keys (accents and plurals are stripped the same way)', () => {
    expect(normalizeNombre('Cilantro')).toBe('cilantro')
    expect(normalizeNombre('semillas de chía')).toBe('semillas de chia')
  })
})
