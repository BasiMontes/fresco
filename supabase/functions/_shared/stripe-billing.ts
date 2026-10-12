// FRESCO-942 (audit C-01, ADR-0043): the ONLY Stripe call in the Edge
// Functions. Account deletion must end the user's Stripe billing before the
// `auth.users` row (and with it `user_profiles.stripe_customer_id`) is gone —
// otherwise the card keeps being charged for an account that no longer exists.
//
// ADR-0007 still holds: the webhook is the only writer of plan/subscription
// columns. This helper writes nothing to the database; it only calls Stripe.
// Business decision (founder): cancel immediately, no refund, no proration.

import { logger } from './logger.ts'

const FN_NAME = 'delete-account'

// Same pin as `lib/stripe.ts`, so the Edge call and the app speak one API version.
const STRIPE_API_VERSION = '2026-08-26.dahlia'

// Subscription states that still bill (or may bill) the customer. `canceled`
// and `incomplete_expired` are terminal: nothing to cancel.
const CANCELLABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])

interface StripePayment {
  status: string
  payment: { type: string, payment_intent?: string | { id: string }, charge?: string | { id: string } }
}

interface StripeInvoice {
  id: string
  amount_paid: number
  lines: { data: Array<{ period: { start: number, end: number } }> }
  payments?: { data: StripePayment[] }
}

interface StripeSubscription {
  id: string
  status: string
  ended_at?: number | null
  canceled_at?: number | null
}

type PaymentRef = { payment_intent: string } | { charge: string }

/** The slice of the Stripe SDK this helper uses — injectable for tests. */
export interface StripeBillingClient {
  subscriptions: {
    list: (
      params: { customer: string, status: 'all', limit: number, starting_after?: string },
    ) => Promise<{ data: StripeSubscription[], has_more: boolean }>
    cancel: (
      id: string,
      params: { invoice_now: boolean, prorate: boolean },
      options: { idempotencyKey: string },
    ) => Promise<unknown>
  }
  invoices: {
    list: (
      params: { subscription: string, status: 'paid', limit: number, expand: string[] },
    ) => Promise<{ data: StripeInvoice[] }>
  }
  refunds: {
    list: (params: PaymentRef & { limit: number }) => Promise<{ data: Array<{ amount: number, status: string | null }> }>
    create: (
      params: PaymentRef & {
        amount: number
        reason: 'requested_by_customer'
        metadata: { user_id: string, subscription_id: string }
      },
      options: { idempotencyKey: string },
    ) => Promise<unknown>
  }
  customers: {
    del: (id: string) => Promise<unknown>
  }
}

export interface CancelStripeBillingInput {
  customerId: string
  userId: string
  /** Test seam. In production the client is built lazily from `STRIPE_SECRET_KEY`. */
  stripe?: StripeBillingClient
  /** Test seam: "now" in epoch seconds. */
  nowSeconds?: number
}

async function createStripeClient(): Promise<StripeBillingClient> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  const { default: Stripe } = await import('stripe')
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  }) as unknown as StripeBillingClient
}

/** `resource_missing` = this key cannot see the object (other-mode id, or already deleted): nothing to cancel. */
function isResourceMissing(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'resource_missing'
}

const idOf = (ref: string | { id: string } | undefined): string | null =>
  typeof ref === 'string' ? ref : (ref?.id ?? null)

/** The payment that settled `invoice`. A paid invoice whose payment cannot be identified fails closed. */
function paymentRefOf(invoice: StripeInvoice): PaymentRef {
  for (const entry of invoice.payments?.data ?? []) {
    if (entry.status !== 'paid') continue
    const intent = idOf(entry.payment.payment_intent)
    if (intent) return { payment_intent: intent }
    const charge = idOf(entry.payment.charge)
    if (charge) return { charge }
  }
  throw new Error(`Paid invoice ${invoice.id} has no identifiable payment to refund`)
}

/**
 * Refunds the unused share of the subscription's latest paid invoice
 * (founder decision: immediate cancellation + proportional refund, in line
 * with the published terms). T is `ended_at` for an already-ended
 * subscription (so a retry is deterministic and a subscription that ran to
 * period end refunds 0) and now for one just cancelled. Nothing is refunded
 * when nothing was paid, or when the payment already has refunds.
 */
async function refundUnusedPeriod(
  stripe: StripeBillingClient,
  sub: StripeSubscription,
  ctx: { userId: string, customerId: string, nowSeconds: number },
): Promise<void> {
  const { data: [invoice] } = await stripe.invoices.list({
    subscription: sub.id,
    status: 'paid',
    limit: 1,
    expand: ['data.payments'],
  })
  if (!invoice || invoice.amount_paid <= 0) return

  const periods = invoice.lines.data.map(line => line.period)
  if (periods.length === 0) throw new Error(`Paid invoice ${invoice.id} has no period to prorate`)
  const start = Math.min(...periods.map(p => p.start))
  const end = Math.max(...periods.map(p => p.end))
  if (end <= start) return

  const alreadyEnded = sub.status === 'canceled'
  const t = alreadyEnded ? (sub.ended_at ?? sub.canceled_at ?? ctx.nowSeconds) : ctx.nowSeconds
  const fraction = Math.min(1, Math.max(0, (end - t) / (end - start)))

  const ref = paymentRefOf(invoice)
  const { data: refunds } = await stripe.refunds.list({ ...ref, limit: 100 })
  const alreadyRefunded = refunds
    .filter(r => r.status !== 'failed' && r.status !== 'canceled')
    .reduce((sum, r) => sum + r.amount, 0)
  if (alreadyRefunded > 0) return

  const amount = Math.min(invoice.amount_paid - alreadyRefunded, Math.round(invoice.amount_paid * fraction))
  if (amount <= 0) return

  await stripe.refunds.create(
    { ...ref, amount, reason: 'requested_by_customer', metadata: { user_id: ctx.userId, subscription_id: sub.id } },
    { idempotencyKey: `delete-account-refund:${ctx.userId}:${invoice.id}` },
  )
}

/**
 * Tolerates `resource_missing` (logged); rethrows anything else. Returns
 * whether the step ran to completion.
 */
async function tolerateMissing(step: () => Promise<void>, warning: string, fields: Record<string, unknown>): Promise<boolean> {
  try {
    await step()
    return true
  } catch (err) {
    if (!isResourceMissing(err)) throw err
    logger.warn(warning, { fn: FN_NAME, ...fields })
    return false
  }
}

/**
 * Ends the customer's Stripe billing: cancels every non-terminal
 * subscription (immediately, no proration), refunds the unused share of the
 * latest paid invoice of each, then deletes the customer. `resource_missing`
 * is tolerated with a warning; any other Stripe error (auth, network, rate
 * limit) is rethrown so the caller can refuse to delete the account. A
 * retry after a partial failure completes the job without double refunding.
 */
export async function cancelStripeBillingForCustomer(input: CancelStripeBillingInput): Promise<void> {
  const { customerId, userId } = input
  const stripe = input.stripe ?? await createStripeClient()
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ctx = { userId, customerId, nowSeconds }

  const subs: StripeSubscription[] = []
  const listed = await tolerateMissing(async () => {
    let startingAfter: string | undefined
    for (;;) {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      subs.push(...page.data)
      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }
  }, 'Stripe customer not found for this key; nothing to cancel', { userId, customerId })
  if (!listed) return

  for (const sub of subs) {
    if (CANCELLABLE_STATUSES.has(sub.status)) {
      await tolerateMissing(async () => {
        await stripe.subscriptions.cancel(
          sub.id,
          { invoice_now: false, prorate: false },
          { idempotencyKey: `delete-account:${userId}:${sub.id}` },
        )
      }, 'Stripe subscription already gone', { userId, customerId, subscriptionId: sub.id })
    }
    if (CANCELLABLE_STATUSES.has(sub.status) || sub.status === 'canceled') {
      await tolerateMissing(
        () => refundUnusedPeriod(stripe, sub, ctx),
        'Stripe payment not found for this key; nothing to refund',
        { userId, customerId, subscriptionId: sub.id },
      )
    }
  }

  await tolerateMissing(async () => {
    await stripe.customers.del(customerId)
  }, 'Stripe customer already gone', { userId, customerId })
}
