import { describe, expect, test } from 'bun:test'
import { isProEntitlementActive } from './entitlement.ts'
import type { UserProfile } from './types.ts'

const NOW = Date.parse('2026-09-02T12:00:00Z')
const PAST = '2026-09-01T12:00:00Z'
const FUTURE = '2026-10-01T12:00:00Z'

function profile(over: Partial<Pick<UserProfile, 'plan' | 'plan_expires_at' | 'payment_failed_at'>>) {
  return { plan: 'pro' as const, plan_expires_at: FUTURE, payment_failed_at: null, ...over }
}

describe('isProEntitlementActive (A4-L8)', () => {
  test('free plan is never Pro', () => {
    expect(isProEntitlementActive(profile({ plan: 'free' }), NOW)).toBe(false)
  })

  test('pro with a future expiry is Pro', () => {
    expect(isProEntitlementActive(profile({ plan: 'pro', plan_expires_at: FUTURE }), NOW)).toBe(true)
  })

  test('family with a future expiry is Pro', () => {
    expect(isProEntitlementActive(profile({ plan: 'family', plan_expires_at: FUTURE }), NOW)).toBe(true)
  })

  test('pro with no expiry (seed / manual / family member) stays Pro', () => {
    expect(isProEntitlementActive(profile({ plan_expires_at: null }), NOW)).toBe(true)
  })

  test('pro with a past expiry and no dunning grace has lapsed (lost webhook)', () => {
    expect(isProEntitlementActive(profile({ plan_expires_at: PAST, payment_failed_at: null }), NOW)).toBe(false)
  })

  test('pro with a past expiry but active payment-failed grace stays Pro', () => {
    expect(isProEntitlementActive(profile({ plan_expires_at: PAST, payment_failed_at: PAST }), NOW)).toBe(true)
  })
})
