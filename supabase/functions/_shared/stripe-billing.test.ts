import { beforeEach, describe, expect, test } from 'bun:test'
import { captureDenoServe } from '@/tests/mocks/edge-function'
import { cancelStripeBillingForCustomer, type StripeBillingClient } from './stripe-billing.ts'

/**
 * FRESCO-942 (audit C-01, ADR-0043) — account deletion must end the Stripe
 * subscription(s) and delete the Stripe customer BEFORE the user row goes.
 * The Stripe client is injected, so none of this touches the network.
 */

// Installs the minimal `Deno` global (`Deno.env`) the helper reads the secret from.
captureDenoServe()

interface Sub { id: string, status: string, ended_at?: number | null, canceled_at?: number | null }
interface FakeInvoice {
  id: string
  amount_paid: number
  status?: string
  lines: { data: Array<{ period: { start: number, end: number } }> }
  payments?: { data: Array<{ status: string, payment: { type: string, payment_intent?: string, charge?: string } }> }
}

const NOW = 1_700_000_000
const DAY = 86_400

/** A paid invoice whose single line covers [start, end], paid through payment intent `pi`. */
function paidInvoice(opts: { amount: number, start: number, end: number, id?: string, pi?: string }): FakeInvoice {
  return {
    id: opts.id ?? 'in_1',
    amount_paid: opts.amount,
    status: 'paid',
    lines: { data: [{ period: { start: opts.start, end: opts.end } }] },
    payments: { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: opts.pi ?? 'pi_1' } }] },
  }
}

let calls: string[] = []
let cancelOptions: Array<{ id: string, params: unknown, options: unknown }> = []
let listed: Sub[] = []
let listError: unknown = null
let cancelError: unknown = null
let delError: unknown = null
let invoicesBySub: Record<string, FakeInvoice[]> = {}
let existingRefunds: Array<{ amount: number, status: string }> = []
let refundError: unknown = null
let refundCalls: Array<{ params: Record<string, unknown>, options: unknown }> = []

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
  invoices: {
    list: async (params) => {
      calls.push(`invoices:${params.subscription}`)
      return { data: invoicesBySub[params.subscription] ?? [] }
    },
  },
  refunds: {
    list: async () => {
      calls.push('refunds.list')
      return { data: existingRefunds }
    },
    create: async (params, options) => {
      calls.push(`refund:${params.amount}`)
      refundCalls.push({ params, options })
      if (refundError) throw refundError
      return { id: 're_1' }
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
  invoicesBySub = {}
  existingRefunds = []
  refundError = null
  refundCalls = []
})

/** Call log without the read-only refund lookups, for the FRESCO-942 base-flow assertions. */
const writes = () => calls.filter(c => !c.startsWith('invoices:') && !c.startsWith('refunds.list'))

describe('cancelStripeBillingForCustomer', () => {
  test('cancels an active subscription, then deletes the customer (in that order)', async () => {
    listed = [{ id: 'sub_1', status: 'active' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(writes()).toEqual(['list:cus_1', 'cancel:sub_1', 'del:cus_1'])
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
    expect(writes()).toEqual(['list:cus_1', 'cancel:sub_t', 'del:cus_1'])
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
    expect(writes()).toEqual(['list:cus_1', 'cancel:sub_a', 'cancel:sub_b', 'del:cus_1'])
  })

  test('only deletes the customer when every subscription is already canceled', async () => {
    listed = [{ id: 'sub_c', status: 'canceled' }]
    await cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe })
    expect(writes()).toEqual(['list:cus_1', 'del:cus_1'])
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
    expect(writes()).toEqual(['list:cus_1', 'cancel:sub_1', 'del:cus_1'])
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
    expect(writes()).toEqual(['list:cus_1'])
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

  describe('prorated refund', () => {
    const run = (extra: { nowSeconds?: number } = {}) =>
      cancelStripeBillingForCustomer({ customerId: 'cus_1', userId: 'user_1', stripe: fakeStripe, nowSeconds: NOW, ...extra })

    test('monthly plan mid-period refunds the unused share of what was paid', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 999, start: NOW - 10 * DAY, end: NOW + 20 * DAY })]
      await run()
      expect(refundCalls).toHaveLength(1)
      expect(refundCalls[0].params).toEqual({
        payment_intent: 'pi_1',
        amount: Math.round(999 * (20 / 30)),
        reason: 'requested_by_customer',
        metadata: { user_id: 'user_1', subscription_id: 'sub_1' },
      })
      expect(refundCalls[0].options).toEqual({ idempotencyKey: 'delete-account-refund:user_1:in_1' })
    })

    test('annual plan early in the term refunds most of the payment', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 7999, start: NOW - 5 * DAY, end: NOW + 360 * DAY })]
      await run()
      expect(refundCalls[0].params.amount).toBe(Math.round(7999 * (360 / 365)))
    })

    test('a trialing subscription with no paid invoice gets no refund', async () => {
      listed = [{ id: 'sub_t', status: 'trialing' }]
      await run()
      expect(refundCalls).toHaveLength(0)
      expect(writes()).toEqual(['list:cus_1', 'cancel:sub_t', 'del:cus_1'])
    })

    test('an invoice with nothing paid (unpaid / past_due) gets no refund', async () => {
      listed = [{ id: 'sub_u', status: 'past_due' }]
      invoicesBySub.sub_u = [{ ...paidInvoice({ amount: 0, start: NOW - DAY, end: NOW + 29 * DAY }), status: 'open' }]
      await run()
      expect(refundCalls).toHaveLength(0)
    })

    test('skips when the payment already has refunds (does not top up)', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 999, start: NOW - 10 * DAY, end: NOW + 20 * DAY })]
      existingRefunds = [{ amount: 100, status: 'succeeded' }]
      await run()
      expect(refundCalls).toHaveLength(0)
    })

    test('failed or canceled earlier refunds do not count as already refunded', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 900, start: NOW - 15 * DAY, end: NOW + 15 * DAY })]
      existingRefunds = [{ amount: 900, status: 'failed' }, { amount: 900, status: 'canceled' }]
      await run()
      expect(refundCalls[0].params.amount).toBe(450)
    })

    test('never refunds more than was paid when the period has not started yet', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 999, start: NOW + 5 * DAY, end: NOW + 35 * DAY })]
      await run()
      expect(refundCalls[0].params.amount).toBe(999)
    })

    test('a subscription that ended at period end refunds nothing', async () => {
      const end = NOW - 2 * DAY
      listed = [{ id: 'sub_c', status: 'canceled', ended_at: end, canceled_at: end - 12 * DAY }]
      invoicesBySub.sub_c = [paidInvoice({ amount: 999, start: end - 30 * DAY, end })]
      await run()
      expect(refundCalls).toHaveLength(0)
      expect(writes()).toEqual(['list:cus_1', 'del:cus_1'])
    })

    test('an already-canceled subscription refunds from when it ended, not from now (retry is deterministic)', async () => {
      const ended = NOW - 3 * DAY
      listed = [{ id: 'sub_c', status: 'canceled', ended_at: ended }]
      invoicesBySub.sub_c = [paidInvoice({ amount: 3000, start: ended - 10 * DAY, end: ended + 20 * DAY })]
      await run()
      expect(refundCalls[0].params.amount).toBe(2000)
    })

    test('refunds each subscription independently', async () => {
      listed = [{ id: 'sub_a', status: 'active' }, { id: 'sub_b', status: 'active' }]
      invoicesBySub.sub_a = [paidInvoice({ amount: 1000, start: NOW - 15 * DAY, end: NOW + 15 * DAY, id: 'in_a', pi: 'pi_a' })]
      invoicesBySub.sub_b = [paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY, id: 'in_b', pi: 'pi_b' })]
      await run()
      expect(refundCalls.map(c => [c.params.payment_intent, c.params.amount])).toEqual([['pi_a', 500], ['pi_b', 400]])
    })

    test('order is cancel, then refund, then customer deletion', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY })]
      await run()
      expect(writes()).toEqual(['list:cus_1', 'cancel:sub_1', 'refund:400', 'del:cus_1'])
    })

    test('refunds through the charge when the invoice payment is a charge', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      const invoice = paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY })
      invoice.payments = { data: [{ status: 'paid', payment: { type: 'charge', charge: 'ch_1' } }] }
      invoicesBySub.sub_1 = [invoice]
      await run()
      expect(refundCalls[0].params.charge).toBe('ch_1')
    })

    test('a paid invoice with no identifiable payment fails closed', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      const invoice = paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY })
      invoice.payments = { data: [] }
      invoicesBySub.sub_1 = [invoice]
      await expect(run()).rejects.toThrow(/payment/i)
      expect(calls).not.toContain('del:cus_1')
    })

    test('a refund failure throws and the customer is not deleted', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY })]
      refundError = Object.assign(new Error('refund down'), { type: 'StripeConnectionError' })
      await expect(run()).rejects.toThrow('refund down')
      expect(calls).not.toContain('del:cus_1')
    })

    test('resource_missing on the refund continues to delete the customer', async () => {
      listed = [{ id: 'sub_1', status: 'active' }]
      invoicesBySub.sub_1 = [paidInvoice({ amount: 600, start: NOW - 10 * DAY, end: NOW + 20 * DAY })]
      refundError = stripeError('resource_missing')
      await run()
      expect(calls).toContain('del:cus_1')
    })
  })
})
