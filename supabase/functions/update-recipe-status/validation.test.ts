import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertEstadoValido, assertRatingValido, assertTransicionPermitida, buildUpdatePayload, CLIENT_SETTABLE_ESTADOS } from './validation.ts'

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

  test('rejects a valid enum value that is not client-settable ("excluida")', () => {
    expect(statusOf(() => assertEstadoValido('excluida'))).toBe(400)
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

describe('"pendiente" is how a mark is taken back (FRESCO-1014)', () => {
  test('is client-settable, and the payload carries only the estado', () => {
    expect(CLIENT_SETTABLE_ESTADOS).toContain('pendiente')
    expect(statusOf(() => assertEstadoValido('pendiente'))).toBeUndefined()
    expect(buildUpdatePayload('pendiente', undefined, 'recipe-x')).toEqual({ estado: 'pendiente' })
  })
})

describe('assertTransicionPermitida (FRESCO-1014, A7-UI-15)', () => {
  const run = (actual: string, nuevo: Parameters<typeof assertTransicionPermitida>[0]['nuevo'], esSemanaActual: boolean) =>
    statusOf(() => assertTransicionPermitida({ actual, nuevo, esSemanaActual }))

  test('an open slot takes the marks it always took, in any week', () => {
    for (const actual of ['pendiente', 'sustituida']) {
      for (const nuevo of ['cocinada', 'descartada', 'sustituida'] as const) {
        expect(run(actual, nuevo, true)).toBeUndefined()
        expect(run(actual, nuevo, false)).toBeUndefined()
      }
    }
  })

  test('an open slot has no mark to take back', () => {
    expect(run('pendiente', 'pendiente', true)).toBe(409)
    expect(run('sustituida', 'pendiente', true)).toBe(409)
  })

  test('a marked slot can be taken back or switched inside the current week', () => {
    expect(run('cocinada', 'pendiente', true)).toBeUndefined()
    expect(run('descartada', 'pendiente', true)).toBeUndefined()
    expect(run('cocinada', 'descartada', true)).toBeUndefined()
    expect(run('descartada', 'cocinada', true)).toBeUndefined()
  })

  test('a marked slot stays closed in any other week', () => {
    for (const nuevo of ['pendiente', 'cocinada', 'descartada', 'sustituida'] as const) {
      expect(run('cocinada', nuevo, false)).toBe(409)
      expect(run('descartada', nuevo, false)).toBe(409)
    }
  })

  test('a marked slot is never replaced, and marking it again with the same mark is refused', () => {
    expect(run('cocinada', 'sustituida', true)).toBe(409)
    expect(run('descartada', 'sustituida', true)).toBe(409)
    expect(run('cocinada', 'cocinada', true)).toBe(409)
    expect(run('descartada', 'descartada', true)).toBe(409)
  })
})
