import { afterEach, describe, expect, test } from 'bun:test'
import { fakeEdgeClient } from '@/tests/mocks/edge-function'
import { StripeNotConfiguredError } from './stripe-billing.ts'
import { assertStripeKeyMatchesBillingMode, StripeModeMismatchError, stripeKeyLivemode } from './stripe-mode.ts'

/** FRESCO-1164 — the Edge Functions' Stripe mode guard (the counterpart of lib/billing/stripe-mode.ts). */

const savedKey = process.env.STRIPE_SECRET_KEY
afterEach(() => {
  if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = savedKey
})

const client = (opts: Parameters<typeof fakeEdgeClient>[0]) => fakeEdgeClient(opts).client as unknown as Parameters<typeof assertStripeKeyMatchesBillingMode>[0]

describe('stripeKeyLivemode', () => {
  test.each([['sk_live_x', true], ['rk_live_x', true], ['sk_test_x', false], ['rk_test_x', false]] as const)('%s -> live=%p', (key, live) => {
    expect(stripeKeyLivemode(key)).toBe(live)
  })

  test.each(['whsec_x', 'pk_live_x', '', 'live'])('%p is not a secret key: its mode is unknown', (key) => {
    expect(() => stripeKeyLivemode(key)).toThrow(StripeModeMismatchError)
  })
})

describe('assertStripeKeyMatchesBillingMode', () => {
  test.each([['sk_test_x', false], ['sk_live_x', true]] as const)('%s on a database serving live=%p passes', async (key, live) => {
    process.env.STRIPE_SECRET_KEY = key
    await expect(assertStripeKeyMatchesBillingMode(client({ rows: { billing_mode: { stripe_livemode: live } } }))).resolves.toBeUndefined()
  })

  test.each([['sk_test_x', true], ['sk_live_x', false]] as const)('%s on a database serving live=%p is refused', async (key, live) => {
    process.env.STRIPE_SECRET_KEY = key
    await expect(assertStripeKeyMatchesBillingMode(client({ rows: { billing_mode: { stripe_livemode: live } } }))).rejects.toThrow(StripeModeMismatchError)
  })

  test('no key is its own error, so a caller that can go without Stripe can tell it apart', async () => {
    delete process.env.STRIPE_SECRET_KEY
    await expect(assertStripeKeyMatchesBillingMode(client({ rows: { billing_mode: { stripe_livemode: false } } }))).rejects.toThrow(StripeNotConfiguredError)
  })

  test('a missing billing_mode row fails closed', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    await expect(assertStripeKeyMatchesBillingMode(client({ rows: { billing_mode: null } }))).rejects.toThrow('billing_mode has no row')
  })

  test('a billing_mode read error is rethrown, not read as a mode', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    await expect(assertStripeKeyMatchesBillingMode(client({ selectError: { billing_mode: { message: 'db down' } } }))).rejects.toMatchObject({ message: 'db down' })
  })
})
