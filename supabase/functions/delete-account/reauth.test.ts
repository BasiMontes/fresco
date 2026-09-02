import { describe, expect, test } from 'bun:test'
import { isTokenRecent, jwtIssuedAt } from './reauth.ts'

/** Minimal unsigned JWT with the given payload — only the payload segment is
 * ever read by these helpers, so header and signature are placeholders. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`
}

const NOW = 1_700_000_000

describe('jwtIssuedAt', () => {
  test('reads a numeric iat', () => {
    expect(jwtIssuedAt(fakeJwt({ iat: NOW }))).toBe(NOW)
  })

  test('returns null for a token with no iat', () => {
    expect(jwtIssuedAt(fakeJwt({ sub: 'user-1' }))).toBeNull()
  })

  test('returns null for a non-numeric iat', () => {
    expect(jwtIssuedAt(fakeJwt({ iat: 'soon' }))).toBeNull()
  })

  test('returns null for a malformed token', () => {
    expect(jwtIssuedAt('not-a-jwt')).toBeNull()
    expect(jwtIssuedAt('')).toBeNull()
    expect(jwtIssuedAt('a.b')).toBe(null) // payload "b" is not valid base64 JSON
  })
})

describe('isTokenRecent (A4-L11 freshness window)', () => {
  const MAX_AGE = 5 * 60

  test('accepts a token issued just now', () => {
    expect(isTokenRecent(fakeJwt({ iat: NOW }), MAX_AGE, NOW)).toBe(true)
  })

  test('accepts a token issued within the window', () => {
    expect(isTokenRecent(fakeJwt({ iat: NOW - 4 * 60 }), MAX_AGE, NOW)).toBe(true)
  })

  test('rejects a token issued outside the window (a leaked older access token)', () => {
    expect(isTokenRecent(fakeJwt({ iat: NOW - 6 * 60 }), MAX_AGE, NOW)).toBe(false)
  })

  test('tolerates minor clock skew (token 30s in the future)', () => {
    expect(isTokenRecent(fakeJwt({ iat: NOW + 30 }), MAX_AGE, NOW)).toBe(true)
  })

  test('rejects a token far in the future (forged iat)', () => {
    expect(isTokenRecent(fakeJwt({ iat: NOW + 3600 }), MAX_AGE, NOW)).toBe(false)
  })

  test('rejects a token with no readable iat', () => {
    expect(isTokenRecent(fakeJwt({ sub: 'user-1' }), MAX_AGE, NOW)).toBe(false)
    expect(isTokenRecent('garbage', MAX_AGE, NOW)).toBe(false)
  })
})
