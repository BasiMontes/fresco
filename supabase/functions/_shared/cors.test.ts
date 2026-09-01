import { describe, expect, it } from 'bun:test'
import { isHostedSupabase, resolveAllowedOrigin } from './cors.ts'

const HOSTED = 'https://jdqemhewjrjuopssdurn.supabase.co'
const LOCAL_STACK = 'http://kong:8000'

describe('isHostedSupabase (FRESCO-364 / A4-L2)', () => {
  it('is true for a hosted project URL', () => {
    expect(isHostedSupabase(HOSTED)).toBe(true)
    expect(isHostedSupabase('https://abc123.supabase.in')).toBe(true)
  })

  it('is false for the local stack and anything unset', () => {
    expect(isHostedSupabase(LOCAL_STACK)).toBe(false)
    expect(isHostedSupabase('http://127.0.0.1:54321')).toBe(false)
    expect(isHostedSupabase('http://localhost:54321')).toBe(false)
    expect(isHostedSupabase('')).toBe(false)
  })
})

describe('resolveAllowedOrigin', () => {
  it('echoes a deployed vercel origin in every environment', () => {
    for (const url of [HOSTED, LOCAL_STACK]) {
      expect(resolveAllowedOrigin('https://fresco-pro.vercel.app', url)).toBe('https://fresco-pro.vercel.app')
      expect(resolveAllowedOrigin('https://fresco-pre.vercel.app', url)).toBe('https://fresco-pre.vercel.app')
      expect(resolveAllowedOrigin('https://fresco-dev.vercel.app', url)).toBe('https://fresco-dev.vercel.app')
    }
  })

  it('blocks localhost on the hosted deployment (the A4-L2 fix)', () => {
    expect(resolveAllowedOrigin('http://localhost:3000', HOSTED)).toBeNull()
  })

  it('allows localhost against the local stack (dev + CI)', () => {
    expect(resolveAllowedOrigin('http://localhost:3000', LOCAL_STACK)).toBe('http://localhost:3000')
  })

  it('blocks an unknown origin and a missing origin', () => {
    expect(resolveAllowedOrigin('https://evil.com', HOSTED)).toBeNull()
    expect(resolveAllowedOrigin('https://evil.com', LOCAL_STACK)).toBeNull()
    expect(resolveAllowedOrigin(null, HOSTED)).toBeNull()
  })
})
