import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertEstadoValido, assertTransicionPermitida, buildUpdatePayload, CLIENT_SETTABLE_ESTADOS } from './validation.ts'

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

describe('"pendiente" is how a mark is taken back (FRESCO-1014)', () => {
  test('is client-settable, and the payload carries only the estado', () => {
    expect(CLIENT_SETTABLE_ESTADOS).toContain('pendiente')
    expect(statusOf(() => assertEstadoValido('pendiente'))).toBeUndefined()
    expect(buildUpdatePayload('pendiente', 'recipe-x')).toEqual({ estado: 'pendiente' })
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
