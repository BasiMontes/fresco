import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertEstadoValido, assertRatingValido, CLIENT_SETTABLE_ESTADOS } from './validation.ts'

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
})
