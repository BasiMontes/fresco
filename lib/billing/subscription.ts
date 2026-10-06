import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;
type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

/** The columns the Stripe webhook needs to decide what a subscription event means for a profile. */
export type BillingProfile = Pick<UserProfileRow, 'id' | 'plan' | 'payment_failed_at' | 'stripe_subscription_id'>;

/**
 * `user_profiles` reads and writes of the Stripe webhook (ADR-0007: the only
 * writer of `plan`, `stripe_customer_id`, `stripe_subscription_id`,
 * `plan_expires_at` and `payment_failed_at`). Moved verbatim out of
 * `app/api/stripe/webhook/route.ts` by FRESCO-810 (ADR-0041): the route keeps
 * the Stripe-event logic, this file owns the table access.
 *
 * Every function takes the service-role client and throws the Supabase error
 * as-is; the webhook catches it, logs it with the Stripe event id and still
 * answers 200 (see the route's doc comment for why).
 */

/**
 * FRESCO-240: the subscription id already on file, or `null`. Stripe retries
 * `checkout.session.completed` on any non-2xx; if this exact subscription is
 * already stored, the delivery ran to completion once.
 */
export async function getStoredSubscriptionId(client: Client, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.stripe_subscription_id ?? null;
}

interface ActivateProPlanArgs {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  planExpiresAt: string
}

/**
 * Initial purchase. FRESCO-232: a fresh checkout starts a clean subscription,
 * so any failed-payment aviso left over from a prior one (out-of-order webhook
 * delivery, or a resubscribe after a lapsed Pro period) is cleared.
 */
export async function activateProPlan(client: Client, { userId, stripeCustomerId, stripeSubscriptionId, planExpiresAt }: ActivateProPlanArgs): Promise<void> {
  const { error } = await client
    .from('user_profiles')
    .update({
      plan: 'pro',
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan_expires_at: planExpiresAt,
      payment_failed_at: null,
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

/** The profile that owns a Stripe customer, or `null` when none matches. */
export async function findProfileByStripeCustomer(client: Client, stripeCustomerId: string): Promise<BillingProfile | null> {
  const { data, error } = await client
    .from('user_profiles')
    .select('id, plan, payment_failed_at, stripe_subscription_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * FRESCO-232: a charge failed inside Stripe's own retry window. `plan` is
 * deliberately untouched (stays `'pro'`); only the aviso flag is set.
 */
export async function markPaymentFailed(client: Client, profileId: string): Promise<void> {
  const { error } = await client
    .from('user_profiles')
    .update({ payment_failed_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
}

/**
 * Pro -> Free: Stripe gave up retrying, or the subscription ended. Also clears
 * a stale payment-failed aviso (FRESCO-232): the account is Free now, the aviso
 * no longer applies. `plan_expires_at` is left as-is, like every other writer.
 */
export async function downgradeToFree(client: Client, profileId: string): Promise<void> {
  const { error } = await client
    .from('user_profiles')
    .update({ plan: 'free', payment_failed_at: null })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
}

/**
 * A renewal-shaped `active` update. FRESCO-232: it also means any prior
 * failed-payment aviso just resolved (the retry succeeded), so it is cleared
 * in the same write.
 */
export async function applyRenewal(client: Client, { profileId, planExpiresAt }: { profileId: string, planExpiresAt: string }): Promise<void> {
  const { error } = await client
    .from('user_profiles')
    .update({ plan: 'pro', plan_expires_at: planExpiresAt, payment_failed_at: null })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
}
