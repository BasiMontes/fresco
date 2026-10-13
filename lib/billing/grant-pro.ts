import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/types';
import { activateProPlan, getStoredSubscriptionId } from '@/lib/billing/subscription';
import { sendSubscriptionConfirmationEmail } from '@/lib/email/resend';
import { captureServerEvent } from '@/lib/posthog/server';
import { resolveCheckoutFunnelEvent } from '@/lib/posthog/stripe-funnel-events';
import { getProPriceIds, resolveAppUrl, resolveProUpdateFromSession, stripe } from '@/lib/stripe';

type Client = SupabaseClient<Database>;

// FRESCO-429 (TRLGDCU art. 98.7): formats the actual amount Stripe charged —
// no separate VAT line is invented, since this checkout has no
// `automatic_tax` configured to compute one.
function formatChargedAmount(unitAmount: number | null | undefined, currency: string | undefined): string {
  const amount = (unitAmount ?? 0) / 100;
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: (currency ?? 'eur').toUpperCase() }).format(amount);
}

function formatRenewalDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Grants Pro to the user a paid Checkout Session belongs to: the ONE place that
 * turns a session into `user_profiles` subscription state (ADR-0007), shared by
 * the Stripe webhook and any recovery path (FRESCO-909).
 *
 * Idempotent: replaying a session whose subscription is already on file rewrites
 * the same values and skips the funnel event and the confirmation email, which
 * only fire for a genuinely new subscription (FRESCO-240).
 *
 * Throws when the session has no subscription, no Pro price is configured, or
 * the session is not a grantable one (`resolveProUpdateFromSession`). The caller
 * decides what a failure means; the webhook logs it and releases its claim.
 */
export async function grantProFromCheckoutSession(client: Client, session: Stripe.Checkout.Session): Promise<void> {
  if (!session.subscription) {
    throw new Error('checkout.session.completed without a subscription id.');
  }

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceIds = getProPriceIds();
  if (priceIds.length === 0) {
    throw new Error('No Pro price id is configured (STRIPE_PRICE_ID_PRO_MONTH).');
  }
  const update = resolveProUpdateFromSession({ session, subscription, expectedPriceId: priceIds });

  // FRESCO-240: Stripe retries checkout.session.completed on any non-2xx
  // response (a transient network blip, a cold-start timeout) -- without
  // this, a retry of an already-processed delivery re-fires the
  // trial_started / trial_converted_to_paid event for the same subscription.
  // If this exact subscription id is already on file, this delivery ran to
  // completion once; a genuinely new subscription always changes it (was
  // null, or a prior, different subscription on resubscribe).
  const storedSubscriptionId = await getStoredSubscriptionId(client, update.userId);
  const isNewSubscription = storedSubscriptionId !== update.stripeSubscriptionId;

  await activateProPlan(client, {
    userId: update.userId,
    stripeCustomerId: update.stripeCustomerId,
    stripeSubscriptionId: update.stripeSubscriptionId,
    planExpiresAt: update.planExpiresAt,
  });

  if (isNewSubscription) {
    // ADR-0013 / FRESCO-366: server-side only — this webhook has no browser,
    // so posthog-js structurally cannot fire here. Checkout always opens a
    // 7-day trial, so the normal event is `trial_started`; a non-trialing
    // status means the trial was skipped and it's paid from day one.
    await captureServerEvent({
      distinctId: update.userId,
      event: resolveCheckoutFunnelEvent(subscription.status),
      properties: {
        stripe_subscription_id: update.stripeSubscriptionId,
        $set: { plan: 'pro' },
      },
    });

    // FRESCO-429 (TRLGDCU art. 98.7): the durable-support subscription
    // confirmation email. The subscription is already active at this point
    // (write above already succeeded) — a send failure is logged for
    // retry/review and never re-thrown, per AC3.
    try {
      const { data: userData, error: userError } = await client.auth.admin.getUserById(update.userId);
      const recipientEmail = userData?.user?.email;
      if (userError || !recipientEmail) {
        throw userError ?? new Error('no email on file for this user');
      }

      const price = subscription.items.data[0]?.price;
      await sendSubscriptionConfirmationEmail({
        to: recipientEmail,
        priceFormatted: formatChargedAmount(price?.unit_amount, price?.currency),
        // `update.planExpiresAt` is the same trial_end-derived timestamp the
        // `user_profiles` write above just used — the next real charge date.
        nextRenewalDateFormatted: formatRenewalDate(update.planExpiresAt),
        manageSubscriptionUrl: `${resolveAppUrl()}/profile`,
      });
    }
    catch (error) {
      console.error(`[grantProFromCheckoutSession] subscription confirmation email failed for user ${update.userId} (subscription ${update.stripeSubscriptionId})`, error);
    }
  }
}
