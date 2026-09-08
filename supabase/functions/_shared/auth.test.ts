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

const { requireAuthenticatedUser, requireServiceRoleCaller } = await import('./auth.ts')

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
