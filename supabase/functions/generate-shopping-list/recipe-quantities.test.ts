import { describe, expect, test } from 'bun:test'
import { indexCantidades } from './recipe-quantities.ts'

describe('indexCantidades (FRESCO-875)', () => {
  test('indexes valid entries by accent-stripped, lowercased name', () => {
    const index = indexCantidades([
      { nombre: 'Brócoli', cantidad: 300, unidad: 'g' },
      { nombre: 'aceite de oliva', cantidad: 2, unidad: 'cucharadas' },
    ])

    expect(index.get('brocoli')).toEqual({ cantidad: 300, unidad: 'g' })
    expect(index.get('aceite de oliva')).toEqual({ cantidad: 2, unidad: 'cucharadas' })
  })

  test('returns an empty index for null, a non-array or an empty array', () => {
    expect(indexCantidades(null).size).toBe(0)
    expect(indexCantidades({ nombre: 'ajo' }).size).toBe(0)
    expect(indexCantidades([]).size).toBe(0)
  })

  test('drops entries with a non-positive, non-finite or non-numeric quantity', () => {
    const index = indexCantidades([
      { nombre: 'ajo', cantidad: 0, unidad: 'dientes' },
      { nombre: 'sal', cantidad: -1, unidad: 'g' },
      { nombre: 'pimienta', cantidad: Number.NaN, unidad: 'g' },
      { nombre: 'harina', cantidad: '200', unidad: 'g' },
    ])

    expect(index.size).toBe(0)
  })

  test('drops entries without a string name or unit, and non-object entries', () => {
    const index = indexCantidades([
      { cantidad: 1, unidad: 'g' },
      { nombre: 'ajo', cantidad: 1 },
      'ajo',
      null,
    ])

    expect(index.size).toBe(0)
  })
})
