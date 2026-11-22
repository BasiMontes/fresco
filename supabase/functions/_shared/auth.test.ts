import type { SupabaseClient, User } from '@supabase/supabase-js'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { HttpError } from './http.ts'

/**
 * `Deno` is a global under the real Edge Function runtime but does not
 * exist under `bun test` (confirmed empirically — `typeof Deno` is
 * `undefined`), so `requireServiceRoleCaller`'s `Deno.env.get(...)` call
 * would throw a bare `ReferenceError` rather than the intended `HttpError`
 * if this file didn't stub it first. Captured/restored like the
 * `globalThis.window` stubbing pattern in `lib/push/first-menu-signal.test.ts`.
 */
const originalDeno = (globalThis as { Deno?: unknown }).Deno
let envValues: Record<string, string | undefined> = {}

;(globalThis as { Deno?: unknown }).Deno = {
  env: { get: (key: string) => envValues[key] },
}

afterAll(() => {
  (globalThis as { Deno?: unknown }).Deno = originalDeno
})

const { isTransientAuthError, requireAuthenticatedUser, requireServiceRoleCaller, sessionCheckFailure } = await import('./auth.ts')

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://x.supabase.co/functions/v1/f', { headers })
}

function fakeSupabase(result: { data: { user: User | null }, error: Error | null }): SupabaseClient {
  return { auth: { getUser: async () => result } } as unknown as SupabaseClient
}

const REAL_USER = { id: 'user-1', email: 'laura@fresco.app' } as unknown as User

describe('requireAuthenticatedUser', () => {
  it('throws 401 when there is no Authorization header', async () => {
    await expect(requireAuthenticatedUser(reqWith(), fakeSupabase({ data: { user: REAL_USER }, error: null })))
      .rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when getUser errors', async () => {
    const supabase = fakeSupabase({ data: { user: null }, error: new Error('invalid token') })
    await expect(requireAuthenticatedUser(reqWith({ Authorization: 'Bearer x' }), supabase))
      .rejects.toBeInstanceOf(HttpError)
  })

  it('throws 401 when getUser resolves no user without an error', async () => {
    const supabase = fakeSupabase({ data: { user: null }, error: null })
    await expect(requireAuthenticatedUser(reqWith({ Authorization: 'Bearer x' }), supabase))
      .rejects.toMatchObject({ status: 401 })
  })

  it('returns the resolved user when the header is present and getUser succeeds', async () => {
    const supabase = fakeSupabase({ data: { user: REAL_USER }, error: null })
    await expect(requireAuthenticatedUser(reqWith({ Authorization: 'Bearer x' }), supabase))
      .resolves.toBe(REAL_USER)
  })
})

/**
 * FRESCO-1250: with the database restarting, Auth answered 500 and `requireAuthenticatedUser` turned it into a 401,
 * which the client reads as an expired session and answers by sending the person to the login page. A failure that
 * is the service's own is now a 503; every other failure, and every ambiguous one, is still the 401.
 */
describe('transient Auth failures (FRESCO-1250)', () => {
  const authError = (name: string, status?: number) => Object.assign(new Error(name), { name, status })
  const withError = (error: Error) => fakeSupabase({ data: { user: null }, error })
  const bearer = reqWith({ Authorization: 'Bearer x' })

  it('an Auth answer of 500 (its database is down) is a 503, not a 401', async () => {
    await expect(requireAuthenticatedUser(bearer, withError(authError('AuthApiError', 500))))
      .rejects.toMatchObject({ status: 503 })
  })

  it('a failed call to Auth (retryable fetch error, a network error carries status 0) is a 503', async () => {
    await expect(requireAuthenticatedUser(bearer, withError(authError('AuthRetryableFetchError', 0))))
      .rejects.toMatchObject({ status: 503 })
    await expect(requireAuthenticatedUser(bearer, withError(authError('AuthRetryableFetchError', 503))))
      .rejects.toMatchObject({ status: 503 })
  })

  it('an invalid or expired token stays a 401', async () => {
    for (const status of [400, 401, 403]) {
      await expect(requireAuthenticatedUser(bearer, withError(authError('AuthApiError', status))))
        .rejects.toMatchObject({ status: 401, message: 'No autorizado' })
    }
  })

  it('an error that says nothing about its status stays a 401, so an ambiguous result still denies', async () => {
    await expect(requireAuthenticatedUser(bearer, withError(new Error('who knows'))))
      .rejects.toMatchObject({ status: 401 })
    await expect(requireAuthenticatedUser(bearer, withError(authError('AuthUnknownError'))))
      .rejects.toMatchObject({ status: 401 })
  })

  it('the 503 says to try again and never says the credentials are wrong', async () => {
    const failed = requireAuthenticatedUser(bearer, withError(authError('AuthApiError', 500)))
    await expect(failed).rejects.toThrow('Inténtalo de nuevo')
    await expect(requireAuthenticatedUser(bearer, withError(authError('AuthApiError', 500)))).rejects.not.toThrow('No autorizado')
  })

  it('isTransientAuthError ignores anything that is not an error object', () => {
    for (const value of [null, undefined, 'boom', 500, {}]) {
      expect(isTransientAuthError(value)).toBe(false)
    }
  })

  it('sessionCheckFailure hands back the caller\'s own 401, message included, when the failure is not transient', () => {
    const own = new HttpError('Credenciales inválidas para esa cuenta.', 401)
    expect(sessionCheckFailure(authError('AuthApiError', 401), own)).toBe(own)
    expect(sessionCheckFailure(null, own)).toBe(own)
    expect(sessionCheckFailure(authError('AuthApiError', 500), own)).not.toBe(own)
  })
})

describe('requireServiceRoleCaller', () => {
  beforeEach(() => {
    envValues = {}
  })

  it('throws 500 when SUPABASE_SECRET_KEYS is not configured', () => {
    expect(() => requireServiceRoleCaller(reqWith())).toThrow(expect.objectContaining({ status: 500 }))
  })

  it('throws 500 when the configured JSON has no default key', () => {
    envValues.SUPABASE_SECRET_KEYS = JSON.stringify({ other: 'sb_secret_x' })
    expect(() => requireServiceRoleCaller(reqWith())).toThrow(expect.objectContaining({ status: 500 }))
  })

  it('throws 401 when the apikey header does not match', () => {
    envValues.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_real' })
    expect(() => requireServiceRoleCaller(reqWith({ apikey: 'sb_secret_wrong' })))
      .toThrow(expect.objectContaining({ status: 401 }))
  })

  it('does not throw when the apikey header matches exactly', () => {
    envValues.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_real' })
    expect(() => requireServiceRoleCaller(reqWith({ apikey: 'sb_secret_real' }))).not.toThrow()
  })
})
