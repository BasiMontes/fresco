import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/types';
import { deliverSubscriptionConfirmation, lookupUserEmail } from '@/lib/billing/confirmation-email';
import { describeModeVerdict, judgeStripeEventMode } from '@/lib/billing/stripe-mode';
import { activateProPlan, getStoredSubscriptionId } from '@/lib/billing/subscription';
import { trialEmailSignals } from '@/lib/billing/trial-email-signals';
import { captureServerEvent } from '@/lib/posthog/server';
import { resolveCheckoutFunnelEvent } from '@/lib/posthog/stripe-funnel-events';
import { getProPriceIds, resolveProUpdateFromSession, stripe } from '@/lib/stripe';

type Client = SupabaseClient<Database>;

/**
 * Grants Pro to the user a paid Checkout Session belongs to: the ONE place that
 * turns a session into `user_profiles` subscription state (ADR-0007), shared by
 * the Stripe webhook and any recovery path (FRESCO-909).
 *
 * Idempotent: replaying a session whose subscription is already on file rewrites
 * the same values and skips the funnel event and the confirmation email, which
 * only fire for a genuinely new subscription (FRESCO-240).
 *
 * FRESCO-1001 (ADR-0061): the session's Stripe mode must belong to this deploy AND to
 * the shared database (`stripe-mode.ts`) before anything is read or written, so a
 * test-mode session never reaches a live database even through a recovery path (the
 * checkout sweep) that does not go through the webhook's own early check. The mode is
 * stored next to the Stripe ids.
 *
 * Throws when the session has no subscription, no Pro price is configured, the mode
 * does not match, or the session is not a grantable one (`resolveProUpdateFromSession`).
 * The caller decides what a failure means; the webhook logs it and releases its claim.
 */
export async function grantProFromCheckoutSession(client: Client, session: Stripe.Checkout.Session): Promise<void> {
  const verdict = await judgeStripeEventMode(client, session.livemode);
  if (!verdict.ok) {
    throw new Error(`Checkout session ${session.id}: ${describeModeVerdict(verdict)} — refusing to grant Pro.`);
  }

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
    stripeLivemode: session.livemode,
  });

  if (isNewSubscription) {
    // ADR-0013 / FRESCO-366: server-side only — this webhook has no browser,
    // so posthog-js structurally cannot fire here. Checkout always opens a
    // 7-day trial, so the normal event is `trial_started`; a non-trialing
    // status means the trial was skipped and it's paid from day one.
    // FRESCO-923: the same lookup feeds the abuse signals on the event and the
    // confirmation email below. A failed lookup only drops the signals.
    const { email: recipientEmail, error: userError } = await lookupUserEmail(client, update.userId);

    await captureServerEvent({
      supabase: client,
      distinctId: update.userId,
      event: resolveCheckoutFunnelEvent(subscription.status),
      properties: {
        stripe_subscription_id: update.stripeSubscriptionId,
        ...trialEmailSignals(recipientEmail),
        $set: { plan: 'pro' },
      },
    });

    // FRESCO-429 (TRLGDCU art. 98.7): the durable-support subscription confirmation email. The
    // subscription is already active at this point (the write above succeeded), so a send
    // failure never undoes it. FRESCO-1005: it is reported to Sentry and left pending for the
    // reconcile cron to retry instead of only being logged.
    await deliverSubscriptionConfirmation(client, { userId: update.userId, subscription, email: recipientEmail, emailLookupError: userError });
  }
}
