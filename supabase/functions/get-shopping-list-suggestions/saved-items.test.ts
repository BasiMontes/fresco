import { describe, expect, test } from 'bun:test'
import { savedItemNames } from './saved-items.ts'

describe('savedItemNames', () => {
  test('lists the names of every item of every aisle', () => {
    const items = [
      { nombre: 'Verduras', orden: 1, items: [{ nombre: 'Tomate' }, { nombre: 'Pimiento' }] },
      { nombre: 'Lácteos', orden: 2, items: [{ nombre: 'Yogur' }] },
    ]

    expect(savedItemNames(items)).toEqual(['Tomate', 'Pimiento', 'Yogur'])
  })

  test('skips malformed items without losing the good ones', () => {
    const items = [
      { nombre: 'Verduras', items: ['Tomate', null, 7, { comprado: true }, { nombre: 42 }, { nombre: 'Pimiento' }] },
    ]

    expect(savedItemNames(items)).toEqual(['Pimiento'])
  })

  test('skips an aisle that is not an object or has no items array', () => {
    const items = [null, 'Verduras', 3, { nombre: 'Sin items' }, { nombre: 'Roto', items: 'Tomate' }, { nombre: 'Bien', items: [{ nombre: 'Ajo' }] }]

    expect(savedItemNames(items)).toEqual(['Ajo'])
  })

  test.each([null, undefined, 'lista', 7, {}])('returns nothing when the column holds %p', (value) => {
    expect(savedItemNames(value)).toEqual([])
  })
})
