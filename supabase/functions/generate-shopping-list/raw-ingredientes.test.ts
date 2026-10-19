import type { SlotWithRecipeRow } from './types.ts'
import { describe, expect, test } from 'bun:test'
import { buildRawIngredientes } from './raw-ingredientes.ts'

/** FRESCO-1010 (A7-LOGIC-07): which slots add ingredients to the list. */

function slot(overrides: Partial<SlotWithRecipeRow> & { nombre?: string, ingredientes?: string[] } = {}): SlotWithRecipeRow {
  const { nombre = 'Receta', ingredientes = ['tomate'], ...rest } = overrides
  return {
    recipe_id: 'r1',
    dia: 'lunes',
    sustitucion_ingrediente: null,
    recipes: { id: 'r1', nombre, meta: { raciones: 2 }, ingredientes_principales: ingredientes, ingredientes_cantidades: null },
    ...rest,
  }
}

const base = { fechaInicio: '2099-03-02', hoy: '2099-03-01', numPersonas: 2 }

describe('buildRawIngredientes', () => {
  test('a pending slot adds its ingredients', () => {
    expect(buildRawIngredientes({ ...base, slots: [slot({ estado: 'pendiente' })] }).map(i => i.nombre)).toEqual(['tomate'])
  })

  test('descartada and excluida slots add nothing', () => {
    const slots = [slot({ estado: 'descartada' }), slot({ estado: 'excluida', dia: 'martes' }), slot({ estado: 'pendiente', dia: 'miercoles', ingredientes: ['arroz'] })]

    expect(buildRawIngredientes({ ...base, slots }).map(i => i.nombre)).toEqual(['arroz'])
  })

  test('cocinada and sustituida slots still count: the household cooked or will cook that recipe', () => {
    const slots = [slot({ estado: 'cocinada' }), slot({ estado: 'sustituida', dia: 'martes', ingredientes: ['arroz'] })]

    expect(buildRawIngredientes({ ...base, slots }).map(i => i.nombre).sort()).toEqual(['arroz', 'tomate'])
  })

  test('a slot without an estado (an older fixture) still counts', () => {
    expect(buildRawIngredientes({ ...base, slots: [slot()] })).toHaveLength(1)
  })

  test('a confirmed substitution swaps the name and the substitute keeps the replaced quantity', () => {
    const withQuantity = slot({ ingredientes: ['nata'], sustitucion_ingrediente: { original: 'Nata', sustituto: 'leche de avena' } })
    withQuantity.recipes!.ingredientes_cantidades = [{ nombre: 'nata', cantidad: 200, unidad: 'ml' }]

    const [raw] = buildRawIngredientes({ ...base, slots: [withQuantity] })

    expect(raw).toMatchObject({ nombre: 'leche de avena', cantidad: 200, unidad: 'ml', raciones_usuario: 2, raciones_receta: 2 })
  })

  test('days already behind us are skipped, unless nothing would remain', () => {
    const slots = [slot({ dia: 'lunes' }), slot({ dia: 'jueves', ingredientes: ['arroz'] })]

    expect(buildRawIngredientes({ ...base, hoy: '2099-03-04', slots }).map(i => i.nombre)).toEqual(['arroz'])
    expect(buildRawIngredientes({ ...base, hoy: '2099-04-01', slots }).map(i => i.nombre).sort()).toEqual(['arroz', 'tomate'])
  })

  test('discarding every slot leaves nothing: it does not fall back to the discarded ones', () => {
    expect(buildRawIngredientes({ ...base, slots: [slot({ estado: 'descartada' })] })).toEqual([])
  })
})
