import type { RawIngrediente } from './types.ts'
import { describe, expect, spyOn, test } from 'bun:test'
import { consolidateIngredientes } from './consolidator.ts'

/** Minimal valid RawIngrediente fixture — one entry per ingredient per recipe slot. */
function makeRaw(overrides: Partial<RawIngrediente> = {}): RawIngrediente {
  return {
    nombre: 'tomate',
    receta_id: 'recipe-1',
    raciones_receta: 4,
    raciones_usuario: 4,
    receta_nombre: 'Receta de prueba',
    dia: 'lunes',
    ...overrides,
  }
}

describe('consolidateIngredientes (FR-4.1 — deterministic, no Gemini call)', () => {
  test('scales the BASE_QUANTITIES entry by raciones_usuario / raciones_receta', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'patata', raciones_receta: 2, raciones_usuario: 4 }),
    ])

    // patata base = 400g; factor 4/2 = 2 -> ceil(400 * 2) = 800g
    expect(result).toEqual([{
      nombre: 'patata',
      cantidad: 800,
      unidad: 'g',
      usos: [{ receta: 'Receta de prueba', dia: 'lunes' }],
    }])
  })

  test('sums the same ingredient across two recipe slots when units are compatible (g + g)', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'champinones', receta_id: 'r1', receta_nombre: 'Champiñones salteados', dia: 'lunes' }),
      makeRaw({ nombre: 'champinones', receta_id: 'r2', receta_nombre: 'Tortilla de champiñones', dia: 'miercoles' }),
    ])

    // champinones base = 250g, factor 1 each -> 250g + 250g = 500g in one line
    expect(result).toEqual([{
      nombre: 'champinones',
      cantidad: 500,
      unidad: 'g',
      usos: [
        { receta: 'Champiñones salteados', dia: 'lunes' },
        { receta: 'Tortilla de champiñones', dia: 'miercoles' },
      ],
    }])
  })

  test('sums across three recipe slots and converts the total to kg past the 1000g threshold', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'salmon', receta_id: 'r1' }),
      makeRaw({ nombre: 'salmon', receta_id: 'r2' }),
      makeRaw({ nombre: 'salmon', receta_id: 'r3' }),
    ])

    // salmon base = 400g, factor 1 each -> 3 x 400g = 1200g -> stored as 1.2kg.
    // This is the exact accumulation shape (real gram quantities, multi-slot
    // summing) that exposed the aisle-pricing flat-price-times-grams bug.
    expect(result).toEqual([{
      nombre: 'salmon',
      cantidad: 1.2,
      unidad: 'kg',
      // All three raws share the default receta_nombre/dia — real 3-slot
      // input is exercised by the dedup test below instead.
      usos: [{ receta: 'Receta de prueba', dia: 'lunes' }],
    }])
  })

  test('falls back to 1 unidad for an ingredient with no BASE_QUANTITIES entry', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'ingrediente inventado', raciones_receta: 4, raciones_usuario: 4 }),
    ])

    expect(result).toEqual([{
      nombre: 'ingrediente inventado',
      cantidad: 1,
      unidad: 'unidades',
      usos: [{ receta: 'Receta de prueba', dia: 'lunes' }],
    }])
  })

  test('merges accent/case variants of the same ingredient name into a single consolidated line', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'Tomate', receta_id: 'r1' }),
      makeRaw({ nombre: 'tomate', receta_id: 'r2' }),
    ])

    // Both normalize to the same key 'tomate' — must merge, not produce two
    // lines. Display nombre keeps the FIRST raw spelling seen ('Tomate'),
    // not the normalized key — FRESCO-196: the normalized key is a lookup
    // key only, never what the user sees.
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      nombre: 'Tomate',
      cantidad: 600,
      unidad: 'g',
      // Both raws share the default receta_nombre/dia — dedup collapses to one uso.
      usos: [{ receta: 'Receta de prueba', dia: 'lunes' }],
    })
  })

  test('keeps a distinct uso per (recipe, day) and dedupes an identical repeat', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'cebolla', receta_id: 'r1', receta_nombre: 'Sofrito base', dia: 'lunes' }),
      makeRaw({ nombre: 'cebolla', receta_id: 'r2', receta_nombre: 'Wok de verduras', dia: 'jueves' }),
      // Same (recipe, day) pair repeated — e.g. the same recipe's ingredient
      // list lists an ingredient twice. Must not produce a duplicate uso.
      makeRaw({ nombre: 'cebolla', receta_id: 'r1', receta_nombre: 'Sofrito base', dia: 'lunes' }),
    ])

    expect(result[0].usos).toEqual([
      { receta: 'Sofrito base', dia: 'lunes' },
      { receta: 'Wok de verduras', dia: 'jueves' },
    ])
  })

  test('FRESCO-196: displays the accented ingredient name, not the accent-stripped lookup key', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'brócoli', receta_id: 'r1' }),
      makeRaw({ nombre: 'limón', receta_id: 'r2' }),
      makeRaw({ nombre: 'champiñones', receta_id: 'r3' }),
    ])

    const nombres = result.map(r => r.nombre)
    expect(nombres).toEqual(['brócoli', 'limón', 'champiñones'])
  })

  // canSumUnits/logger.warn ("Unidades incompatibles") only fire when the same
  // normalized key resolves to two different unit families across a merge.
  // Given the current code, `unidadBase` is looked up purely from
  // BASE_QUANTITIES[key] (or the fixed 'unidades' fallback) — both sides of
  // any same-key merge always derive from that same lookup, so the two units
  // being compared can never actually diverge through the public function.
  // This test documents that observed behavior (no false-positive warnings on
  // real multi-recipe input) rather than fabricating an unreachable branch;
  // see the final report for this as a flagged-but-unfixed dead-code finding.
  test('never logs "Unidades incompatibles" while merging the same real ingredient across recipes', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    consolidateIngredientes([
      makeRaw({ nombre: 'Tomate', receta_id: 'r1' }),
      makeRaw({ nombre: 'tomate', receta_id: 'r2' }),
      makeRaw({ nombre: 'TOMATE', receta_id: 'r3' }),
    ])

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  // FRESCO-382 (A4-M5): a non-positive `raciones_receta` makes
  // `raciones_usuario / raciones_receta` Infinity or NaN, which poisons every
  // downstream cost. The guard skips the row and logs instead.
  describe('non-positive raciones_receta guard', () => {
    test.each([
      ['zero', 0],
      ['negative', -4],
      ['NaN', Number.NaN],
    ])('skips the row and warns when raciones_receta is %s', (_label, raciones) => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

      const result = consolidateIngredientes([
        makeRaw({ nombre: 'patata', raciones_receta: raciones as number }),
        makeRaw({ nombre: 'tomate', raciones_receta: 4, raciones_usuario: 4 }),
      ])

      // Bad row dropped; the healthy row still consolidates normally.
      expect(result).toEqual([{
        nombre: 'tomate',
        cantidad: 300,
        unidad: 'g',
        usos: [{ receta: 'Receta de prueba', dia: 'lunes' }],
      }])
      expect(warnSpy).toHaveBeenCalledTimes(1)
      warnSpy.mockRestore()
    })

    test('no ingredient survives when every row has a bad raciones_receta', () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

      const result = consolidateIngredientes([
        makeRaw({ nombre: 'patata', raciones_receta: 0 }),
        makeRaw({ nombre: 'tomate', raciones_receta: 0 }),
      ])

      expect(result).toEqual([])
      expect(warnSpy).toHaveBeenCalledTimes(2)
      warnSpy.mockRestore()
    })
  })
})
