import type Stripe from 'stripe';

/**
 * FRESCO-1002 (audit 7b: A7-PAY-02) — what stops a second Checkout from becoming a second
 * subscription.
 *
 * The profile still says `free` until the webhook lands, and a user with no Stripe customer
 * had nothing to look a subscription up by. The checkout route now gives every user a
 * customer up front (this does NOT write the profile: the webhook stays the only writer,
 * ADR-0007, and keeps persisting the id from the completed session), and asks Stripe, not
 * the profile, whether a live subscription exists.
 */

type StripeClient = Pick<Stripe, 'customers' | 'subscriptions' | 'checkout'>;

/** Subscription states that already hold or may still collect the person's money. */
const ENDED_STATUSES: ReadonlyArray<Stripe.Subscription.Status> = ['canceled', 'incomplete_expired'];

/** Concurrent POSTs inside this window share one idempotency key, so Stripe returns one session. */
const BUCKET_SECONDS = 60;

/**
 * Stripe accepts an `expires_at` between 30 minutes and 24 hours after creation. It is
 * counted from the START of the bucket (so every POST of the bucket sends identical
 * parameters, which an idempotent retry requires), and a bucket is 60 s long: 32 minutes
 * leaves the session at least 31 minutes of life whatever second the POST lands on.
 */
const SESSION_TTL_SECONDS = 32 * 60;

/** Stripe's search query syntax quotes values with `'`; a user id is a uuid, but never trust the shape. */
function escapeSearchValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'');
}

/**
 * The Stripe customer for this user. A stored id (same mode, checked by the caller) wins.
 * Otherwise the customer is found by its `supabase_user_id` metadata, and created only if
 * none exists. The create is keyed on the user, so two concurrent first checkouts get the
 * same customer; the search covers the case where the 24 h life of an idempotency key has
 * passed. The search index lags by up to a minute, which the key covers.
 */
export async function ensureCheckoutCustomer(
  stripe: StripeClient,
  { userId, email, storedCustomerId }: { userId: string, email: string | undefined, storedCustomerId: string | null },
): Promise<string> {
  if (storedCustomerId) {
    return storedCustomerId;
  }

  const found = await stripe.customers.search({
    query: `metadata['supabase_user_id']:'${escapeSearchValue(userId)}'`,
    limit: 1,
  });
  if (found.data[0]) {
    return found.data[0].id;
  }

  const created = await stripe.customers.create(
    { metadata: { supabase_user_id: userId }, ...(email ? { email } : {}) },
    { idempotencyKey: `fresco-customer:${userId}` },
  );
  return created.id;
}

/** True when the customer has a subscription that has not ended. Throws on a Stripe error. */
export async function hasLiveSubscription(stripe: StripeClient, customerId: string): Promise<boolean> {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return subscriptions.data.some(subscription => !ENDED_STATUSES.includes(subscription.status));
}

/**
 * Expires every Checkout Session still open for the customer except `keepSessionId`, so at
 * most one is payable at a time: two tabs cannot both end in a paid subscription. Called
 * AFTER the new session exists, because a repeat POST in the same bucket gets that same
 * session back from Stripe and must not expire it. Throws on a Stripe error.
 */
export async function expireOtherOpenCheckoutSessions(stripe: StripeClient, { customerId, keepSessionId }: { customerId: string, keepSessionId: string }): Promise<void> {
  const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 });
  await Promise.all(open.data.filter(session => session.id !== keepSessionId).map(async session => stripe.checkout.sessions.expire(session.id)));
}

/**
 * The idempotency key and `expires_at` of a Checkout Session: stable per user, plan and
 * minute, so the same double-click or double-tab POST maps to one Stripe session.
 */
export function checkoutSessionWindow({ userId, interval, now = Date.now() }: { userId: string, interval: string, now?: number }): { idempotencyKey: string, expiresAt: number } {
  const bucket = Math.floor(now / 1000 / BUCKET_SECONDS);
  return {
    idempotencyKey: `fresco-checkout:${userId}:${interval}:${bucket}`,
    expiresAt: bucket * BUCKET_SECONDS + SESSION_TTL_SECONDS,
  };
}
