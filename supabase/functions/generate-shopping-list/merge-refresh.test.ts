import type { ShoppingListPasillo } from '../../../api/schemas/shopping-list.types.ts'
import { describe, expect, test } from 'bun:test'
import { costeDeLista, mergeRefreshedList } from './merge-refresh.ts'

/** FRESCO-1010 (A7-LOGIC-07): "Actualizar lista" keeps what the person already did. */

function pasillo(nombre: string, orden: number, items: ShoppingListPasillo['items']): ShoppingListPasillo {
  return { nombre, orden, items }
}
const item = (nombre: string, cantidad: number, unidad: string, extra: Partial<ShoppingListPasillo['items'][number]> = {}) =>
  ({ nombre, cantidad, unidad, comprado: false, ...extra })

describe('mergeRefreshedList', () => {
  test('keeps the bought mark of an item that is still needed in the same amount', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g', { comprado: true })])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g')])]

    expect(mergeRefreshedList(anterior, nueva)[0].items[0].comprado).toBe(true)
  })

  test('keeps it when less is needed now', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g', { comprado: true })])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 250, 'g')])]

    expect(mergeRefreshedList(anterior, nueva)[0].items[0].comprado).toBe(true)
  })

  test('unchecks an item whose need grew: the difference still has to be bought', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g', { comprado: true })])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 700, 'g')])]

    expect(mergeRefreshedList(anterior, nueva)[0].items[0].comprado).toBe(false)
  })

  test('matches by name without accents or case, and by unit', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Brócoli', 300, 'g', { comprado: true })])]

    expect(mergeRefreshedList(anterior, [pasillo('Frutas y verduras', 1, [item('brocoli', 300, 'g')])])[0].items[0].comprado).toBe(true)
    expect(mergeRefreshedList(anterior, [pasillo('Frutas y verduras', 1, [item('brocoli', 1, 'unidades')])])[0].items[0].comprado).toBe(false)
  })

  test('a substitute that is new arrives unchecked and the replaced ingredient disappears', () => {
    const anterior = [pasillo('Lácteos y huevos', 5, [item('Nata', 200, 'ml', { comprado: true })])]
    const nueva = [pasillo('Lácteos y huevos', 5, [item('Leche de avena', 200, 'ml')])]

    const [lacteos] = mergeRefreshedList(anterior, nueva)

    expect(lacteos.items.map(i => [i.nombre, i.comprado])).toEqual([['Leche de avena', false]])
  })

  test('keeps the items the person added from the suggestions, in their aisle', () => {
    const anterior = [
      pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g'), item('Fresas', 1, 'unidades', { origen: 'sugerencia', comprado: true })]),
    ]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g')])]

    const items = mergeRefreshedList(anterior, nueva)[0].items

    expect(items.map(i => i.nombre)).toEqual(['Tomate', 'Fresas'])
    expect(items[1]).toMatchObject({ origen: 'sugerencia', comprado: true })
  })

  test('recreates the aisle of a suggestion when the new list has no such aisle', () => {
    const anterior = [pasillo('Bebidas', 13, [item('Zumo', 1, 'unidades', { origen: 'sugerencia' })])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g')])]

    expect(mergeRefreshedList(anterior, nueva).map(p => p.nombre)).toEqual(['Frutas y verduras', 'Bebidas'])
  })

  test('when the plan now needs what was added as a suggestion, the plan line wins and inherits the bought mark', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Tomate', 2, 'unidades', { origen: 'sugerencia', comprado: true })])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Tomate', 2, 'unidades')])]

    const items = mergeRefreshedList(anterior, nueva)[0].items

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ nombre: 'Tomate', comprado: true })
    expect(items[0].origen).toBeUndefined()
  })

  test('an item no longer needed disappears, bought or not', () => {
    const anterior = [pasillo('Frutas y verduras', 1, [item('Tomate', 400, 'g', { comprado: true }), item('Pepino', 1, 'unidades')])]
    const nueva = [pasillo('Frutas y verduras', 1, [item('Pepino', 1, 'unidades')])]

    expect(mergeRefreshedList(anterior, nueva)[0].items.map(i => i.nombre)).toEqual(['Pepino'])
  })
})

describe('costeDeLista', () => {
  test('sums the per-item estimates into the same band as classifyShoppingList', () => {
    const pasillos = [pasillo('A', 1, [item('x', 1, 'g', { precio_estimado: 10 }), item('y', 1, 'g', { precio_estimado: 5 }), item('z', 1, 'g')])]

    expect(costeDeLista(pasillos)).toEqual({ min: 12.75, max: 17.25 })
  })
})
