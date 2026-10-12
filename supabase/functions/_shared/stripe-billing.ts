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

/** The slice of the Stripe SDK this helper uses — injectable for tests. */
export interface StripeBillingClient {
  subscriptions: {
    list: (
      params: { customer: string, status: 'all', limit: number, starting_after?: string },
    ) => Promise<{ data: Array<{ id: string, status: string }>, has_more: boolean }>
    cancel: (
      id: string,
      params: { invoice_now: boolean, prorate: boolean },
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

/**
 * Cancels every non-terminal subscription of `customerId` (immediately, no
 * refund, no proration) and then deletes the Stripe customer. `resource_missing`
 * is tolerated with a warning; any other Stripe error (auth, network, rate
 * limit) is rethrown so the caller can refuse to delete the account.
 */
export async function cancelStripeBillingForCustomer(input: CancelStripeBillingInput): Promise<void> {
  const { customerId, userId } = input
  const stripe = input.stripe ?? await createStripeClient()

  try {
    let startingAfter: string | undefined
    for (;;) {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      for (const sub of page.data) {
        if (!CANCELLABLE_STATUSES.has(sub.status)) continue
        try {
          await stripe.subscriptions.cancel(
            sub.id,
            { invoice_now: false, prorate: false },
            { idempotencyKey: `delete-account:${userId}:${sub.id}` },
          )
        } catch (err) {
          if (!isResourceMissing(err)) throw err
          logger.warn('Stripe subscription already gone', { fn: FN_NAME, userId, customerId, subscriptionId: sub.id })
        }
      }
      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }

    await stripe.customers.del(customerId)
  } catch (err) {
    if (!isResourceMissing(err)) throw err
    logger.warn('Stripe customer not found for this key; nothing to cancel', { fn: FN_NAME, userId, customerId })
  }
}
