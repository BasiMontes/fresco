import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { captureDenoServe, edgeRequest, type EdgeHandler, fakeEdgeClient, getEdgeHandler } from '@/tests/mocks/edge-function'

/**
 * FRESCO-411 — orchestration coverage for `delete-account/index.ts`
 * (FRESCO-70 + ADR-0023 recent-re-auth). Pure `_shared/token-recency.ts` helpers keep
 * their own tests; this pins the handler: auth → rate-limit → (registered
 * only) recent-re-auth → service-role `admin.deleteUser`, and the guest
 * short-circuit.
 */

const MAIN_AUTH = 'Bearer main.jwt'
let clientsByAuth: Record<string, ReturnType<typeof fakeEdgeClient>> = {}
let serviceClient = fakeEdgeClient()

captureDenoServe()
mock.module('../_shared/supabase-client.ts', () => ({
  createRequestClient: (authHeader: string) => (clientsByAuth[authHeader] ?? fakeEdgeClient({ user: null })).client,
}))
mock.module('../_shared/service-role-client.ts', () => ({ createServiceRoleClient: () => serviceClient.client }))

// FRESCO-942: the Stripe SDK is faked at the package boundary so the real
// `_shared/stripe-billing.ts` runs. `stripeCalls` records call ORDER;
// `deletedUsersAtStripeDel` proves `auth.admin.deleteUser` had not run yet.
let stripeCalls: string[] = []
let stripeSubs: Array<{ id: string, status: string, ended_at?: number, cancellation_details?: { comment: string } }> = []
let stripeFailure: { on: 'list' | 'cancel' | 'del' | 'refund', error: unknown } | null = null
let stripeInvoices: unknown[] = []
let refundLedger: Array<{ amount: number, status: string }> = []
let deletedUsersAtStripeDel: number | null = null
const RealStripe = (await import('stripe')).default
// Extends the real class so statics (`errors`, `createFetchHttpClient`) survive: `mock.module` leaks across test files.
class FakeStripe extends RealStripe {
  constructor(key: string, config?: ConstructorParameters<typeof RealStripe>[1]) {
    super(key, config)
    Object.defineProperty(this, 'subscriptions', { value: this.fakeSubscriptions })
    Object.defineProperty(this, 'customers', { value: this.fakeCustomers })
    Object.defineProperty(this, 'invoices', { value: this.fakeInvoices })
    Object.defineProperty(this, 'refunds', { value: this.fakeRefunds })
  }

  fakeInvoices = {
    list: async (params: { subscription: string }) => {
      stripeCalls.push(`invoices:${params.subscription}`)
      return { data: stripeInvoices }
    },
  }

  fakeRefunds = {
    list: async () => ({ data: refundLedger }),
    create: async (params: { amount: number }) => {
      stripeCalls.push(`refund:${params.amount}`)
      if (stripeFailure?.on === 'refund') throw stripeFailure.error
      refundLedger.push({ amount: params.amount, status: 'succeeded' })
      return { id: 're_1' }
    },
  }

  fakeSubscriptions = {
    list: async (params: { customer: string }) => {
      stripeCalls.push(`list:${params.customer}`)
      if (stripeFailure?.on === 'list') throw stripeFailure.error
      return { data: stripeSubs, has_more: false }
    },
    cancel: async (id: string) => {
      stripeCalls.push(`cancel:${id}`)
      if (stripeFailure?.on === 'cancel') throw stripeFailure.error
      return { id, status: 'canceled' }
    },
  }
  fakeCustomers = {
    del: async (id: string) => {
      stripeCalls.push(`del:${id}`)
      deletedUsersAtStripeDel = serviceClient.deletedUserIds.length
      if (stripeFailure?.on === 'del') throw stripeFailure.error
      return { id, deleted: true }
    },
  }
}
mock.module('stripe', () => ({ default: FakeStripe }))

await import('./index.ts')
const handler: EdgeHandler = getEdgeHandler()

/** Unsigned JWT with the given `iat` (seconds) + `sub` — `token-recency.ts` only reads the payload. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const NOW_S = Math.floor(Date.now() / 1000)
const OK_RATE = { check_and_increment_rate_limit: { data: true } }

beforeEach(() => {
  clientsByAuth = {}
  serviceClient = fakeEdgeClient()
  stripeCalls = []
  stripeSubs = []
  stripeFailure = null
  stripeInvoices = []
  refundLedger = []
  deletedUsersAtStripeDel = null
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
})

const STRIPE_BLOCKED_MESSAGE = 'No hemos podido cancelar tu suscripción ni gestionar la devolución, así que no hemos borrado tu cuenta. Inténtalo de nuevo en unos minutos; si sigue fallando, escríbenos.'

/** A service client whose `user_profiles` row carries a Stripe customer id (or an explicit null/absent row). */
function withProfile(row: { stripe_customer_id: string | null } | null, extra: Parameters<typeof fakeEdgeClient>[0] = {}) {
  serviceClient = fakeEdgeClient({ rows: { user_profiles: row }, ...extra })
}

function registered(reauthUserId: string | null, iat = NOW_S) {
  const reauthToken = jwt({ iat, sub: reauthUserId ?? 'x' })
  clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: OK_RATE })
  clientsByAuth[`Bearer ${reauthToken}`] = fakeEdgeClient({ user: reauthUserId ? { id: reauthUserId } : null })
  return reauthToken
}

describe('delete-account/index.ts', () => {
  test('401 with no Authorization header', async () => {
    const res = await handler(edgeRequest({}, { auth: null }))
    expect(res.status).toBe(401)
  })

  test('401 when the JWT resolves to no user', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: null })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('429 when rate-limited', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: { check_and_increment_rate_limit: { data: false } } })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(429)
  })

  test('401 when a registered caller sends no reauthToken', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'user_1', is_anonymous: false }, rpc: OK_RATE })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
    expect(serviceClient.deletedUserIds).toHaveLength(0)
  })

  test('401 when the reauthToken is stale', async () => {
    const token = registered('user_1', NOW_S - 10 * 60)
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('401 when the reauthToken belongs to a different user', async () => {
    const token = registered('someone_else')
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(401)
  })

  test('200 and deletes the account for a registered caller with a fresh reauthToken', async () => {
    const token = registered('user_1')
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })
    expect(serviceClient.deletedUserIds).toEqual(['user_1'])
  })

  test('200 for a guest caller without any reauth step', async () => {
    clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'guest_1', is_anonymous: true }, rpc: OK_RATE })
    const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
    expect(res.status).toBe(200)
    expect(serviceClient.deletedUserIds).toEqual(['guest_1'])
  })

  test('500 when admin.deleteUser fails', async () => {
    const token = registered('user_1')
    serviceClient = fakeEdgeClient({ adminDeleteError: new Error('supabase admin down') })
    const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
    expect(res.status).toBe(500)
  })

  describe('Stripe cleanup (FRESCO-942)', () => {
    test('skips Stripe entirely when the user has no customer id', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: null })
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(stripeCalls).toEqual([])
      expect(serviceClient.deletedUserIds).toEqual(['user_1'])
    })

    test('skips Stripe when there is no profile row at all', async () => {
      const token = registered('user_1')
      withProfile(null)
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(stripeCalls).toEqual([])
    })

    test('cancels the subscription and deletes the customer BEFORE deleting the user', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_1', status: 'active' }]
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(stripeCalls.filter(c => !c.startsWith('invoices:'))).toEqual(['list:cus_1', 'cancel:sub_1', 'del:cus_1'])
      expect(deletedUsersAtStripeDel).toBe(0)
      expect(serviceClient.deletedUserIds).toEqual(['user_1'])
    })

    test('cancels a trialing subscription too', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_t', status: 'trialing' }]
      await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(stripeCalls).toContain('cancel:sub_t')
    })

    test('continues to delete the account when Stripe says resource_missing', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_old' })
      stripeFailure = { on: 'list', error: Object.assign(new Error('No such customer'), { code: 'resource_missing' }) }
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(serviceClient.deletedUserIds).toEqual(['user_1'])
    })

    test('502 with the retry message and NO deletion when Stripe fails (network/auth/rate limit)', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_1', status: 'active' }]
      stripeFailure = { on: 'cancel', error: Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' }) }
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: STRIPE_BLOCKED_MESSAGE })
      expect(serviceClient.deletedUserIds).toHaveLength(0)
    })

    test('502 and NO deletion when STRIPE_SECRET_KEY is missing but a customer exists', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      delete process.env.STRIPE_SECRET_KEY
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(502)
      expect(serviceClient.deletedUserIds).toHaveLength(0)
    })

    test('500 and NO deletion when the customer-id read fails', async () => {
      const token = registered('user_1')
      withProfile(null, { selectError: { user_profiles: { message: 'db down' } } })
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(500)
      expect(stripeCalls).toEqual([])
      expect(serviceClient.deletedUserIds).toHaveLength(0)
    })

    const NOW_S2 = Math.floor(Date.now() / 1000)
    const paidMonthly = () => [{
      id: 'in_1',
      amount_paid: 1000,
      lines: { data: [{
        amount: 1000,
        period: { start: NOW_S2 - 15 * 86_400, end: NOW_S2 + 15 * 86_400 },
        parent: { type: 'subscription_item_details', subscription_item_details: { proration: false, subscription: 'sub_1' } },
      }] },
      payments: { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] },
    }]

    test('order: cancel, then prorated refund, then customer deletion, all before the user', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_1', status: 'active' }]
      stripeInvoices = paidMonthly()
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(stripeCalls.filter(c => !c.startsWith('invoices:'))).toEqual(['list:cus_1', 'cancel:sub_1', 'refund:500', 'del:cus_1'])
      expect(deletedUsersAtStripeDel).toBe(0)
      expect(serviceClient.deletedUserIds).toEqual(['user_1'])
    })

    test('502 and NO deletion when the refund fails', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_1', status: 'active' }]
      stripeInvoices = paidMonthly()
      stripeFailure = { on: 'refund', error: Object.assign(new Error('refund down'), { type: 'StripeConnectionError' }) }
      const res = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(res.status).toBe(502)
      expect(serviceClient.deletedUserIds).toHaveLength(0)
    })

    test('a retry after the refund succeeded but deleteUser failed does not refund twice', async () => {
      const token = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' }, { adminDeleteError: new Error('supabase admin down') })
      stripeSubs = [{ id: 'sub_1', status: 'active' }]
      stripeInvoices = paidMonthly()
      const first = await handler(edgeRequest({ reauthToken: token }, { auth: MAIN_AUTH }))
      expect(first.status).toBe(500)

      const retryToken = registered('user_1')
      withProfile({ stripe_customer_id: 'cus_1' })
      stripeSubs = [{ id: 'sub_1', status: 'canceled', ended_at: NOW_S2, cancellation_details: { comment: 'delete-account:user_1' } }]
      const second = await handler(edgeRequest({ reauthToken: retryToken }, { auth: MAIN_AUTH }))
      expect(second.status).toBe(200)
      expect(stripeCalls.filter(c => c.startsWith('refund:'))).toEqual(['refund:500'])
    })

    test('a guest with no customer id never touches Stripe', async () => {
      clientsByAuth[MAIN_AUTH] = fakeEdgeClient({ user: { id: 'guest_1', is_anonymous: true }, rpc: OK_RATE })
      withProfile(null)
      const res = await handler(edgeRequest({}, { auth: MAIN_AUTH }))
      expect(res.status).toBe(200)
      expect(stripeCalls).toEqual([])
    })
  })
})
