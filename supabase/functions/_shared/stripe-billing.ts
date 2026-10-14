// FRESCO-942 (audit C-01, ADR-0043): the ONLY Stripe call in the Edge
// Functions. Account deletion must end the user's Stripe billing before the
// `auth.users` row (and with it `user_profiles.stripe_customer_id`) is gone —
// otherwise the card keeps being charged for an account that no longer exists.
//
// ADR-0007 still holds: the webhook is the only writer of plan/subscription
// columns. This helper writes nothing to the database; it only calls Stripe.
// Business decision (founder): cancel immediately and refund the unused part of
// the paid period pro rata (the published terms promise it).

import { logger } from './logger.ts'

const FN_NAME = 'delete-account'

// Same pin as `lib/stripe.ts`, so the Edge call and the app speak one API version.
const STRIPE_API_VERSION = '2026-09-30.endive'

// Subscription states that still bill (or may bill) the customer. `canceled`
// and `incomplete_expired` are terminal: nothing to cancel.
const CANCELLABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])

interface StripePayment {
  status: string
  payment: { type: string, payment_intent?: string | { id: string }, charge?: string | { id: string } }
}

interface StripeInvoiceLine {
  amount: number
  period: { start: number, end: number }
  parent?: {
    type: string
    subscription_item_details?: { proration: boolean, subscription: string | null } | null
  } | null
}

interface StripeInvoice {
  id: string
  amount_paid: number
  lines: { data: StripeInvoiceLine[] }
  status_transitions?: { paid_at: number | null }
  payments?: { data: StripePayment[] }
}

interface StripeSubscription {
  id: string
  status: string
  ended_at?: number | null
  canceled_at?: number | null
  cancellation_details?: { comment?: string | null } | null
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
      params: { invoice_now: boolean, prorate: boolean, cancellation_details: { comment: string } },
      options: { idempotencyKey: string },
    ) => Promise<{ ended_at?: number | null }>
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
  checkout: {
    sessions: {
      list: (
        params: { status: 'complete', created: { gte: number }, limit: number, starting_after?: string },
      ) => Promise<{ data: StripeCheckoutSession[], has_more: boolean }>
    }
  }
}

/** The slice of a Checkout Session the customer lookup reads. */
interface StripeCheckoutSession {
  id: string
  client_reference_id?: string | null
  customer?: string | { id: string } | null
}

export interface CancelStripeBillingInput {
  customerId: string
  userId: string
  /** Test seam. In production the client is built lazily from `STRIPE_SECRET_KEY`. */
  stripe?: StripeBillingClient
  /** Test seam: "now" in epoch seconds. */
  nowSeconds?: number
}

/**
 * The Stripe key is not configured in this environment. A distinct class so a caller that can
 * safely go on without Stripe (the customer lookup for an account with no stored customer id)
 * can tell it from a Stripe outage, which must keep failing closed.
 */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super('STRIPE_SECRET_KEY is not set')
    this.name = 'StripeNotConfiguredError'
  }
}

async function createStripeClient(): Promise<StripeBillingClient> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    throw new StripeNotConfiguredError()
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

// Refund failures that mean "this payment can no longer be refunded". Erasure
// wins over the refund: these are logged (with the amount owed) and the
// deletion goes on. Codes confirmed in Stripe's error-codes reference; a broad
// invalid_request_error catch-all is deliberately NOT used.
const NON_REFUNDABLE_CODES = new Set(['charge_already_refunded', 'charge_disputed', 'refund_disputed_payment'])

// Stripe refuses card refunds on charges older than 180 days.
const REFUND_WINDOW_SECONDS = 180 * 86_400

/** Marks a cancellation made by this flow, so a retry can tell it from an older one. */
const cancellationMarker = (userId: string) => `delete-account:${userId}`

/** The payment that settled `invoice`, or null when it cannot be refunded by API (e.g. out-of-band `payment_record`). */
function paymentRefOf(invoice: StripeInvoice): PaymentRef | null {
  for (const entry of invoice.payments?.data ?? []) {
    if (entry.status !== 'paid') continue
    const intent = idOf(entry.payment.payment_intent)
    if (intent) return { payment_intent: intent }
    const charge = idOf(entry.payment.charge)
    if (charge) return { charge }
  }
  return null
}

/** Period covered by the subscription's own recurring lines (no proration, one-off or credit lines). */
function paidPeriodOf(invoice: StripeInvoice, subscriptionId: string): { start: number, end: number } | null {
  const lines = invoice.lines.data.filter((line) => {
    const details = line.parent?.type === 'subscription_item_details' ? line.parent.subscription_item_details : null
    return !!details && !details.proration && line.amount > 0
      && (details.subscription === null || details.subscription === subscriptionId)
  })
  if (lines.length === 0) return null
  return {
    start: Math.min(...lines.map(l => l.period.start)),
    end: Math.max(...lines.map(l => l.period.end)),
  }
}

interface BillingContext {
  userId: string
  customerId: string
  nowSeconds: number
}

/**
 * Refunds the unused share of the subscription's latest paid invoice
 * (founder decision: immediate cancellation + proportional refund, in line
 * with the published terms). `endedAt` is when the subscription stopped
 * (taken from the cancel response, or the subscription's own `ended_at` on a
 * retry), so both runs compute the same amount; a subscription that ran to
 * period end refunds 0. Top-up semantics: refund `target - alreadyRefunded`,
 * never beyond what was paid. Payments that cannot be refunded by API are
 * logged with the amount owed and do NOT block the deletion.
 */
async function refundUnusedPeriod(
  stripe: StripeBillingClient,
  sub: StripeSubscription,
  endedAt: number,
  ctx: BillingContext,
): Promise<void> {
  const { data: invoices } = await stripe.invoices.list({
    subscription: sub.id,
    status: 'paid',
    limit: 5,
    expand: ['data.payments'],
  })
  const invoice = invoices.find(inv => inv.amount_paid > 0)
  if (!invoice) return

  const owed = (amountOwed: number | null, reason: string) =>
    logger.error(`Stripe refund needs manual handling: ${reason}`, {
      fn: FN_NAME,
      userId: ctx.userId,
      customerId: ctx.customerId,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
      amountOwed,
    })

  const period = paidPeriodOf(invoice, sub.id)
  const fraction = period && period.end > period.start
    ? Math.min(1, Math.max(0, (period.end - endedAt) / (period.end - period.start)))
    : 0
  const target = Math.round(invoice.amount_paid * fraction)

  if (!period) {
    owed(null, 'no subscription line to prorate')
    return
  }
  const ref = paymentRefOf(invoice)
  if (!ref) {
    owed(target, 'payment cannot be refunded by API')
    return
  }
  const paidAt = invoice.status_transitions?.paid_at
  if (paidAt && ctx.nowSeconds - paidAt > REFUND_WINDOW_SECONDS && target > 0) {
    owed(target, 'payment is older than the 180-day refund window')
    return
  }

  const { data: refunds } = await stripe.refunds.list({ ...ref, limit: 100 })
  const alreadyRefunded = refunds
    .filter(r => r.status !== 'failed' && r.status !== 'canceled')
    .reduce((sum, r) => sum + r.amount, 0)
  const amount = Math.min(invoice.amount_paid - alreadyRefunded, Math.max(0, target - alreadyRefunded))
  if (amount <= 0) return

  try {
    await stripe.refunds.create(
      { ...ref, amount, reason: 'requested_by_customer', metadata: { user_id: ctx.userId, subscription_id: sub.id } },
      { idempotencyKey: `delete-account-refund:${ctx.userId}:${invoice.id}:${amount}` },
    )
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code
    if (typeof code !== 'string' || !NON_REFUNDABLE_CODES.has(code)) throw err
    owed(amount, `Stripe refused the refund (${code})`)
  }
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
 * retry after a partial failure completes the job without double refunding
 * (top-up semantics + amount-keyed idempotency).
 */
export async function cancelStripeBillingForCustomer(input: CancelStripeBillingInput): Promise<void> {
  const { customerId, userId } = input
  const stripe = input.stripe ?? await createStripeClient()
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ctx: BillingContext = { userId, customerId, nowSeconds }

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
    const fields = { userId, customerId, subscriptionId: sub.id }
    let endedAt: number | null = null

    if (CANCELLABLE_STATUSES.has(sub.status)) {
      const cancelled = await tolerateMissing(async () => {
        const result = await stripe.subscriptions.cancel(
          sub.id,
          { invoice_now: false, prorate: false, cancellation_details: { comment: cancellationMarker(userId) } },
          { idempotencyKey: `delete-account:${userId}:${sub.id}` },
        )
        endedAt = result.ended_at ?? nowSeconds
      }, 'Stripe subscription already gone', fields)
      if (!cancelled) continue
    }
    else if (sub.status === 'canceled' && sub.cancellation_details?.comment === cancellationMarker(userId)) {
      // Cancelled by an earlier attempt of this same flow: finish its refund.
      endedAt = sub.ended_at ?? sub.canceled_at ?? nowSeconds
    }

    if (endedAt !== null) {
      const when = endedAt
      await tolerateMissing(
        () => refundUnusedPeriod(stripe, sub, when, ctx),
        'Stripe payment not found for this key; nothing to refund',
        fields,
      )
    }
  }

  await tolerateMissing(async () => {
    await stripe.customers.del(customerId)
  }, 'Stripe customer already gone', { userId, customerId })
}

/** How far back `findStripeCustomerForUser` looks: wider than the webhook retry window and the daily sweep. */
const CHECKOUT_LOOKBACK_SECONDS = 72 * 3600

export interface FindStripeCustomerInput {
  userId: string
  /** Test seam. In production the client is built lazily from `STRIPE_SECRET_KEY`. */
  stripe?: StripeBillingClient
  /** Test seam: "now" in epoch seconds. */
  nowSeconds?: number
}

/**
 * FRESCO-945 (review of FRESCO-942): the Stripe customer of a user whose profile has no
 * `stripe_customer_id` yet. Only the webhook writes that column, so someone who paid and deletes
 * the account before the webhook lands (or while it fails) would otherwise keep being billed
 * once the cascade erased the only link. Stripe cannot filter Checkout Sessions by
 * `client_reference_id`, so this lists the completed sessions of the last 72 hours and filters
 * here. Returns the customer of the most recent match, or null when there is none.
 *
 * Throws on any Stripe error (the caller refuses to delete the account, as for a failed
 * cancellation) and throws `StripeNotConfiguredError` when the key is missing. Writes nothing
 * (ADR-0007, ADR-0043).
 */
export async function findStripeCustomerForUser(input: FindStripeCustomerInput): Promise<string | null> {
  const { userId } = input
  const stripe = input.stripe ?? await createStripeClient()
  const since = (input.nowSeconds ?? Math.floor(Date.now() / 1000)) - CHECKOUT_LOOKBACK_SECONDS

  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe.checkout.sessions.list({
      status: 'complete',
      created: { gte: since },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    // Newest first, so the first match is the most recent session.
    const match = page.data.find(session => session.client_reference_id === userId && idOf(session.customer ?? undefined) !== null)
    if (match) return idOf(match.customer ?? undefined)
    if (!page.has_more || page.data.length === 0) return null
    startingAfter = page.data[page.data.length - 1].id
  }
}
