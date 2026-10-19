import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertEstadoValido, buildUpdatePayload, CLIENT_SETTABLE_ESTADOS } from './validation.ts'

function statusOf(fn: () => void): number | undefined {
  try {
    fn()
  } catch (err) {
    return err instanceof HttpError ? err.status : -1
  }
  return undefined
}

describe('assertEstadoValido (A4-L7)', () => {
  for (const estado of CLIENT_SETTABLE_ESTADOS) {
    test(`accepts "${estado}"`, () => {
      expect(() => assertEstadoValido(estado)).not.toThrow()
    })
  }

  test('rejects a valid enum value that is not client-settable ("pendiente")', () => {
    expect(statusOf(() => assertEstadoValido('pendiente'))).toBe(400)
  })

  test('rejects "excluida" (system-assigned only)', () => {
    expect(statusOf(() => assertEstadoValido('excluida'))).toBe(400)
  })

  test('rejects garbage', () => {
    expect(statusOf(() => assertEstadoValido('DROP TABLE'))).toBe(400)
  })

  test('rejects non-string', () => {
    expect(statusOf(() => assertEstadoValido(3))).toBe(400)
    expect(statusOf(() => assertEstadoValido(null))).toBe(400)
    expect(statusOf(() => assertEstadoValido(undefined))).toBe(400)
  })
})

describe('buildUpdatePayload (A4-L7 — fields gated by estado)', () => {
  test('sustituida: applies recipe_id', () => {
    expect(buildUpdatePayload('sustituida', 'recipe-x')).toEqual({
      estado: 'sustituida',
      recipe_id: 'recipe-x',
    })
  })

  test('cocinada: ignores nueva_recipe_id', () => {
    expect(buildUpdatePayload('cocinada', 'recipe-x')).toEqual({ estado: 'cocinada' })
  })

  test('descartada with a stray nueva_recipe_id: recipe_id never written', () => {
    expect(buildUpdatePayload('descartada', 'recipe-x')).toEqual({
      estado: 'descartada',
    })
  })

  test('omits the optional field when it is not supplied', () => {
    expect(buildUpdatePayload('cocinada', undefined)).toEqual({ estado: 'cocinada' })
  })
})
