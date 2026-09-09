import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertEstadoValido, assertRatingValido, buildUpdatePayload, CLIENT_SETTABLE_ESTADOS } from './validation.ts'

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

describe('assertRatingValido (A4-L7)', () => {
  test('accepts undefined (rating is optional)', () => {
    expect(() => assertRatingValido(undefined)).not.toThrow()
  })

  for (const rating of [1, 2, 3, 4, 5]) {
    test(`accepts integer ${rating}`, () => {
      expect(() => assertRatingValido(rating)).not.toThrow()
    })
  }

  test('rejects the numeric-string "3"', () => {
    expect(statusOf(() => assertRatingValido('3'))).toBe(400)
  })

  test('rejects a non-integer float (3.7)', () => {
    expect(statusOf(() => assertRatingValido(3.7))).toBe(400)
  })

  test('rejects null', () => {
    expect(statusOf(() => assertRatingValido(null))).toBe(400)
  })

  test('rejects out-of-range integers (0 and 6)', () => {
    expect(statusOf(() => assertRatingValido(0))).toBe(400)
    expect(statusOf(() => assertRatingValido(6))).toBe(400)
  })

  // FRESCO-465 — explicit boundary-value batch on the 1..5 integer frontier.
  // The FRESCO-381 rating moving-average denominator itself is the Postgres
  // trigger `update_recipe_learning()`, covered by
  // `supabase/tests/recipe_learning_trigger.test.sql` (pgTAP); this is the
  // edge-function-side input gate that trigger relies on.
  describe('boundary values (FRESCO-465)', () => {
    test.each([
      ['1 (lower bound)', 1, undefined],
      ['5 (upper bound)', 5, undefined],
      ['5.0 (integer-valued float, accepted)', 5.0, undefined],
      ['0 (just below lower bound)', 0, 400],
      ['6 (just above upper bound)', 6, 400],
      ['-1 (negative)', -1, 400],
      ['1.5 (fractional in range)', 1.5, 400],
      ['NaN', Number.NaN, 400],
      ['Infinity', Number.POSITIVE_INFINITY, 400],
    ] as const)('rating %s', (_label, rating, expectedStatus) => {
      expect(statusOf(() => assertRatingValido(rating))).toBe(expectedStatus)
    })

    test('first vote: undefined is the "no rating given" boundary and is accepted', () => {
      expect(statusOf(() => assertRatingValido(undefined))).toBeUndefined()
    })
  })
})

describe('buildUpdatePayload (A4-L7 — fields gated by estado)', () => {
  test('sustituida: applies recipe_id, ignores rating', () => {
    expect(buildUpdatePayload('sustituida', 5, 'recipe-x')).toEqual({
      estado: 'sustituida',
      recipe_id: 'recipe-x',
    })
  })

  test('cocinada: applies rating, ignores nueva_recipe_id', () => {
    expect(buildUpdatePayload('cocinada', 4, 'recipe-x')).toEqual({
      estado: 'cocinada',
      rating: 4,
    })
  })

  test('descartada with a stray nueva_recipe_id: recipe_id never written', () => {
    expect(buildUpdatePayload('descartada', undefined, 'recipe-x')).toEqual({
      estado: 'descartada',
    })
  })

  test('omits both optional fields when neither is supplied', () => {
    expect(buildUpdatePayload('cocinada', undefined, undefined)).toEqual({ estado: 'cocinada' })
  })
})
