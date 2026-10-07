import { describe, expect, it } from 'bun:test'
import { isTokenRecent, MAX_TOKEN_AGE_SECONDS, readIssuedAt } from './token-recency.ts'

const NOW = 1_800_000_000

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenWith(claims: Record<string, unknown>): string {
  return `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify(claims))}.signature`
}

describe('readIssuedAt', () => {
  it('reads iat from a base64url payload', () => {
    expect(readIssuedAt(tokenWith({ iat: NOW }))).toBe(NOW)
  })

  it('returns null for a token with no iat, a non-numeric iat, or no readable payload', () => {
    expect(readIssuedAt(tokenWith({ sub: 'user-1' }))).toBeNull()
    expect(readIssuedAt(tokenWith({ iat: 'yesterday' }))).toBeNull()
    expect(readIssuedAt('not-a-jwt')).toBeNull()
    expect(readIssuedAt('a.%%%.c')).toBeNull()
    expect(readIssuedAt('')).toBeNull()
  })
})

describe('isTokenRecent', () => {
  it('accepts a token issued just now and one right at the limit', () => {
    expect(isTokenRecent(tokenWith({ iat: NOW }), { nowSeconds: NOW })).toBe(true)
    expect(isTokenRecent(tokenWith({ iat: NOW - MAX_TOKEN_AGE_SECONDS }), { nowSeconds: NOW })).toBe(true)
  })

  it('rejects a token older than the window', () => {
    expect(isTokenRecent(tokenWith({ iat: NOW - MAX_TOKEN_AGE_SECONDS - 1 }), { nowSeconds: NOW })).toBe(false)
    expect(isTokenRecent(tokenWith({ iat: NOW - 3600 }), { nowSeconds: NOW })).toBe(false)
  })

  it('tolerates a small clock skew but not a token from the future', () => {
    expect(isTokenRecent(tokenWith({ iat: NOW + 30 }), { nowSeconds: NOW })).toBe(true)
    expect(isTokenRecent(tokenWith({ iat: NOW + 3600 }), { nowSeconds: NOW })).toBe(false)
  })

  it('rejects a token it cannot read an iat from', () => {
    expect(isTokenRecent(tokenWith({ sub: 'user-1' }), { nowSeconds: NOW })).toBe(false)
    expect(isTokenRecent('garbage', { nowSeconds: NOW })).toBe(false)
  })

  it('honours a custom window and uses the real clock by default', () => {
    expect(isTokenRecent(tokenWith({ iat: NOW - 100 }), { nowSeconds: NOW, maxAgeSeconds: 60 })).toBe(false)
    expect(isTokenRecent(tokenWith({ iat: Math.floor(Date.now() / 1000) }))).toBe(true)
  })
})
