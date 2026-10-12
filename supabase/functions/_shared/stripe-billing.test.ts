import { beforeEach, describe, expect, test } from 'bun:test'
import { cancelStripeBillingForCustomer, type StripeBillingClient } from './stripe-billing.ts'

/**
 * FRESCO-942 (audit C-01, ADR-0043) — account deletion must end the Stripe
 * subscription(s) and delete the Stripe customer BEFORE the user row goes.
 * The Stripe client is injected, so none of this touches the network.
 */

interface Sub { id: string, status: string }

let calls: string[] = []
let cancelOptions: Array<{ id: string, params: unknown, options: unknown }> = []
let listed: Sub[] = []
let listError: unknown = null
let cancelError: unknown = null
let delError: unknown = null

const fakeStripe: StripeBillingClient = {
  subscriptions: {
    list: async (params) => {
      calls.push(`list:${params.customer}`)
      if (listError) throw listError
      return { data: listed, has_more: false }
    },
    cancel: async (id, params, options) => {
      calls.push(`cancel:${id}`)
      cancelOptions.push({ id, params, options })
      if (cancelError) throw cancelError
      return { id, status: 'canceled' }
    },
  },
  customers: {
    del: async (id) => {
      calls.push(`del:${id}`)
      if (delError) throw delError
      return { id, deleted: true }
    },
  },
}

const stripeError = (code: string) => Object.assign(new Error(`stripe ${code}`), { type: 'StripeInvalidRequestError', code })

beforeEach(() => {
  calls = []
  cancelOptions = []
  listed = []
  listError = null
  cancelError = null
  delError = null
})

describe('cancelStripeBillingForCustomer', () => {
  test('cancels an active subscription, then deletes the customer (in that order)', async () => {
    listed = [{ id: 'sub_1', status: 'active' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toEqual(['list:cus_1', 'cancel:sub_1', 'del:cus_1'])
  })

  test('cancels immediately with no refund and no proration, with a per-sub idempotency key', async () => {
    listed = [{ id: 'sub_1', status: 'active' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(cancelOptions).toEqual([{
      id: 'sub_1',
      params: { invoice_now: false, prorate: false },
      options: { idempotencyKey: 'delete-account:user_1:sub_1' },
    }])
  })

  test('cancels a trialing subscription', async () => {
    listed = [{ id: 'sub_t', status: 'trialing' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toEqual(['list:cus_1', 'cancel:sub_t', 'del:cus_1'])
  })

  test.each(['past_due', 'unpaid', 'incomplete', 'paused'])('cancels a %s subscription', async (status) => {
    listed = [{ id: 'sub_x', status }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toContain('cancel:sub_x')
  })

  test('cancels every non-terminal subscription and skips terminal ones', async () => {
    listed = [
      { id: 'sub_a', status: 'active' },
      { id: 'sub_b', status: 'trialing' },
      { id: 'sub_c', status: 'canceled' },
      { id: 'sub_d', status: 'incomplete_expired' },
    ]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toEqual(['list:cus_1', 'cancel:sub_a', 'cancel:sub_b', 'del:cus_1'])
  })

  test('only deletes the customer when every subscription is already canceled', async () => {
    listed = [{ id: 'sub_c', status: 'canceled' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toEqual(['list:cus_1', 'del:cus_1'])
  })

  test('resource_missing while listing means nothing to cancel: continues without throwing', async () => {
    listError = stripeError('resource_missing')
    await expect(
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe }),
    ).resolves.toBeUndefined()
    expect(calls).not.toContain('cancel:sub_1')
  })

  test('resource_missing while cancelling a subscription continues to delete the customer', async () => {
    listed = [{ id: 'sub_1', status: 'active' }]
    cancelError = stripeError('resource_missing')
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(calls).toEqual(['list:cus_1', 'cancel:sub_1', 'del:cus_1'])
  })

  test('resource_missing while deleting the customer resolves', async () => {
    delError = stripeError('resource_missing')
    await expect(
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe }),
    ).resolves.toBeUndefined()
  })

  test('an auth error while listing throws', async () => {
    listError = Object.assign(new Error('bad key'), { type: 'StripeAuthenticationError' })
    await expect(
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe }),
    ).rejects.toThrow('bad key')
    expect(calls).toEqual(['list:cus_1'])
  })

  test('a network error while cancelling throws and never deletes the customer', async () => {
    listed = [{ id: 'sub_1', status: 'active' }]
    cancelError = Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' })
    await expect(
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe }),
    ).rejects.toThrow('socket hang up')
    expect(calls).not.toContain('del:cus_1')
  })

  test('a rate-limit error while deleting the customer throws', async () => {
    delError = Object.assign(new Error('slow down'), { type: 'StripeRateLimitError', code: 'rate_limit' })
    await expect(
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe }),
    ).rejects.toThrow('slow down')
  })

  test('a missing STRIPE_SECRET_KEY with a customer id throws (no injected client)', async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    try {
      await expect(
        cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1' }),
      ).rejects.toThrow(/STRIPE_SECRET_KEY/)
    }
    finally {
      if (previous !== undefined) process.env.STRIPE_SECRET_KEY = previous
    }
  })
})
