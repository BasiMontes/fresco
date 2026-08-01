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
    ...overrides,
  }
}

describe('consolidateIngredientes (FR-4.1 — deterministic, no Gemini call)', () => {
  test('scales the BASE_QUANTITIES entry by raciones_usuario / raciones_receta', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'patata', raciones_receta: 2, raciones_usuario: 4 }),
    ])

    // patata base = 400g; factor 4/2 = 2 -> ceil(400 * 2) = 800g
    expect(result).toEqual([{ nombre: 'patata', cantidad: 800, unidad: 'g' }])
  })

  test('sums the same ingredient across two recipe slots when units are compatible (g + g)', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'champinones', receta_id: 'r1' }),
      makeRaw({ nombre: 'champinones', receta_id: 'r2' }),
    ])

    // champinones base = 250g, factor 1 each -> 250g + 250g = 500g in one line
    expect(result).toEqual([{ nombre: 'champinones', cantidad: 500, unidad: 'g' }])
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
    expect(result).toEqual([{ nombre: 'salmon', cantidad: 1.2, unidad: 'kg' }])
  })

  test('falls back to 1 unidad for an ingredient with no BASE_QUANTITIES entry', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'ingrediente inventado', raciones_receta: 4, raciones_usuario: 4 }),
    ])

    expect(result).toEqual([{ nombre: 'ingrediente inventado', cantidad: 1, unidad: 'unidades' }])
  })

  test('merges accent/case variants of the same ingredient name into a single consolidated line', () => {
    const result = consolidateIngredientes([
      makeRaw({ nombre: 'Tomate', receta_id: 'r1' }),
      makeRaw({ nombre: 'tomate', receta_id: 'r2' }),
    ])

    // Both normalize to the same key 'tomate' — must merge, not produce two lines.
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ nombre: 'tomate', cantidad: 600, unidad: 'g' })
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
})
