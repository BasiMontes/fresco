import { describe, expect, test } from 'bun:test'
import { isProEntitlementActive, PAYMENT_GRACE_DAYS } from './entitlement.ts'
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

  test('past_due for 30 days still keeps Pro, the day it runs out is the last one (FRESCO-1003)', () => {
    const failed = new Date(NOW - PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    expect(isProEntitlementActive(profile({ plan_expires_at: PAST, payment_failed_at: failed }), NOW)).toBe(true)
  })

  test('past_due for more than 30 days does not give the entitlement (FRESCO-1003)', () => {
    const failed = new Date(NOW - (PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000 + 1)).toISOString()

    expect(isProEntitlementActive(profile({ plan_expires_at: PAST, payment_failed_at: failed }), NOW)).toBe(false)
  })

  test('an old payment_failed_at does not matter while the paid period has not ended (FRESCO-1003)', () => {
    expect(isProEntitlementActive(profile({ plan_expires_at: FUTURE, payment_failed_at: '2026-01-01T00:00:00Z' }), NOW)).toBe(true)
  })

  test('a payment_failed_at that cannot be read gives no grace (FRESCO-1003)', () => {
    expect(isProEntitlementActive(profile({ plan_expires_at: PAST, payment_failed_at: 'not-a-date' }), NOW)).toBe(false)
  })
})
