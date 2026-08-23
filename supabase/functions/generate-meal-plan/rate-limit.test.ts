import { describe, expect, test } from 'bun:test'
import { HttpError } from '../_shared/http.ts'
import { assertRateLimitAllowed } from './rate-limit.ts'

describe('assertRateLimitAllowed (ADR-0010, FRESCO-243)', () => {
  test('does not throw when allowed is true', () => {
    expect(() => assertRateLimitAllowed(true)).not.toThrow()
  })

  test('throws a 429 HttpError when allowed is false', () => {
    let caught: unknown
    try {
      assertRateLimitAllowed(false)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(HttpError)
    expect((caught as HttpError).status).toBe(429)
  })

  test('fail-closed: throws when allowed is null (ambiguous RPC result)', () => {
    expect(() => assertRateLimitAllowed(null)).toThrow(HttpError)
  })

  test('fail-closed: throws when allowed is undefined', () => {
    expect(() => assertRateLimitAllowed(undefined)).toThrow(HttpError)
  })
})
