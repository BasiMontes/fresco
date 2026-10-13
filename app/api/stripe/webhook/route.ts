import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { grantProFromCheckoutSession } from '@/lib/billing/grant-pro';
import { applyRenewal, downgradeToFree, findProfileByStripeCustomer, markPaymentFailed } from '@/lib/billing/subscription';
import { claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent } from '@/lib/billing/webhook-events';
import { POSTHOG_EVENTS } from '@/lib/posthog/event-names';
import { captureServerEvent } from '@/lib/posthog/server';
import { previousSubscriptionStatus, resolveActiveUpdateFunnelEvent } from '@/lib/posthog/stripe-funnel-events';
import { getProPriceIds, resolveCancellationCustomerId, resolvePaymentStatusUpdate, resolveRenewalUpdate, resolveWebhookSecret, stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/stripe/webhook — the ONLY writer of `user_profiles.plan` /
 * `stripe_customer_id` / `stripe_subscription_id` / `plan_expires_at`
 * (ADR-0007). Never called from the client or from the Checkout return page
 * — Stripe calls this directly, signed with the per-environment webhook
 * secret (`resolveWebhookSecret()` in `lib/stripe.ts` — `_DEV` / `_PRE` /
 * `_PROD` by `VERCEL_ENV` + branch).
 *
 * Reads the raw body via `request.text()` (App Router route handlers don't
 * parse the body automatically, unlike the old Pages Router — no extra
 * config needed) because `stripe.webhooks.constructEvent` verifies the
 * signature against the exact raw bytes Stripe sent; a re-serialized JSON
 * body would fail verification.
 *
 * FRESCO-816 (audit-6 A6-S10): every handled event is claimed by `event.id` in
 * `stripe_webhook_events` before it runs. A re-delivery (Stripe retries, a dashboard
 * resend) of a completed event is answered 200 without running the handler again; a
 * handler that throws gives the claim back, so a resend of a failed event still runs.
 * FRESCO-909 (audit C-03): the claim also expires. It is stamped `completed_at` once the
 * handler succeeds; a claim with no completion older than the TTL (the run died after the
 * claim: timeout, crash, deploy) is retaken by the next delivery, while a younger one is
 * answered 409 (so Stripe keeps retrying) and left to its worker. The "200 on failure" policy
 * below is only for handler failures.
 * `checkout.session.completed` only grants Pro when the session is paid or no payment
 * was due (`resolveProUpdateFromSession`); `checkout.session.async_payment_succeeded`
 * is the same grant for a delayed payment method once the money arrives.
 *
 * Handles `checkout.session.completed` (initial purchase), `customer.
 * subscription.updated` (renewal — keeps `plan: 'pro'` and refreshes
 * `plan_expires_at`; also carries the FRESCO-232 payment-failed signal —
 * `past_due` sets `payment_failed_at` while Stripe keeps retrying, `unpaid`
 * downgrades straight to `plan: 'free'` once Stripe gives up retrying, and a
 * recovered `active` clears the aviso), and `customer.subscription.deleted`
 * (the subscription's paid period actually ended some other way — downgrades
 * to `plan: 'free'`). Every other event type is a 200 no-op. FRESCO-231
 * (cancel/manage) reuses this same handler rather than registering a
 * separate webhook.
 *
 * A user *requesting* cancellation is NOT handled specially: Stripe fires
 * `customer.subscription.updated` with `status` still `'active'` and
 * `cancel_at_period_end: true` in that case, which the renewal branch below
 * already treats as a normal active-subscription update (keeps Pro) — per
 * this story's AC, cancellation should only take effect once the paid period
 * actually ends, which is `customer.subscription.deleted`.
 *
 * Once the signature verifies, a downstream failure (e.g. the Supabase
 * write) is logged with the Stripe event id and this still returns 200 —
 * deliberate, not an oversight: a non-2xx response makes Stripe retry
 * delivery, and retrying a bug just repeats the same failure. Manual replay
 * from the Stripe Dashboard is the recovery path for a logged failure.
 */
/** Event types this route acts on; only these are claimed in `stripe_webhook_events`. */
const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Explicit on purpose: without Fluid compute the Hobby default is 10 s, and a handler
 * (Stripe lookup, writes, email) can take longer. 60 s is the limit the claim TTL
 * (webhook-events.ts) is sized against; Fluid compute's higher limits are not relied upon.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = resolveWebhookSecret();

  if (!signature || !webhookSecret) {
    console.error('[/api/stripe/webhook] missing signature header or webhook signing secret for this environment');
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
  catch (error) {
    console.error('[/api/stripe/webhook] signature verification failed', error);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 });
  }

  const handled = HANDLED_EVENT_TYPES.has(event.type);
  const claims = createServiceClient();
  let held: { eventId: string, claimedAt: string } | null = null;
  const eventTags = { stripe_event_id: event.id, stripe_event_type: event.type };
  if (handled) {
    let claim: Awaited<ReturnType<typeof claimWebhookEvent>>;
    try {
      claim = await claimWebhookEvent(claims, { eventId: event.id, eventType: event.type });
    }
    catch (error) {
      // Could not record the event: answer non-2xx so Stripe retries, rather than
      // processing it without the guard.
      console.error(`[/api/stripe/webhook] could not claim event ${event.id}`, error);
      Sentry.captureException(error, { tags: eventTags });
      return NextResponse.json({ error: 'No se pudo registrar el evento.' }, { status: 500 });
    }
    if (claim.state === 'already_done') {
      console.info(`[/api/stripe/webhook] event ${event.id} (${event.type}) already processed, skipping`);
      return NextResponse.json({ received: true });
    }
    if (claim.state === 'in_flight') {
      // Not 2xx: a 2xx tells Stripe the event was delivered and stops its retries, but this
      // claim may belong to a run that died and only becomes retakeable after the TTL.
      // 409 keeps Stripe's backoff going until the run completes or the claim expires.
      console.info(`[/api/stripe/webhook] event ${event.id} (${event.type}) is being processed by another run; asking Stripe to retry`);
      return NextResponse.json({ error: 'Evento en proceso.' }, { status: 409 });
    }
    held = { eventId: event.id, claimedAt: claim.claimedAt };
    if (claim.state === 'taken_over') {
      console.warn(`[/api/stripe/webhook] event ${event.id} (${event.type}) had an expired claim (${claim.claimAgeSeconds}s old); retaking it`);
      try {
        Sentry.captureMessage('Stripe webhook retook an expired event claim', {
          level: 'warning',
          tags: eventTags,
          extra: { claim_age_seconds: claim.claimAgeSeconds },
        });
      }
      catch {
        // Reporting must never stop the retaken event from running and completing.
      }
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated({ subscription: event.data.object, previousAttributes: event.data.previous_attributes, eventId: event.id });
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, event.id);
        break;
      default:
        // No-op — every event type this handler doesn't react to yet.
        break;
    }
    if (held) {
      try {
        await completeWebhookEvent(claims, held);
      }
      catch (completeError) {
        // The work is done; an open claim only means a later delivery retakes it after
        // the TTL and repeats writes that are idempotent. Still answer 200.
        console.error(`[/api/stripe/webhook] could not mark event ${event.id} completed`, completeError);
        Sentry.captureException(completeError, { tags: eventTags });
      }
    }
  }
  catch (error) {
    // Signature already verified above — log + still 200 to avoid a Stripe
    // retry storm on a bug. See doc comment.
    console.error(`[/api/stripe/webhook] failed to process event ${event.id}`, error);
    Sentry.captureException(error, { tags: eventTags });
    if (held) {
      try {
        await releaseWebhookEvent(claims, held);
      }
      catch (releaseError) {
        console.error(`[/api/stripe/webhook] could not release event ${event.id}; a resend of it will be skipped until the claim expires`, releaseError);
        Sentry.captureException(releaseError, { tags: eventTags });
      }
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  await grantProFromCheckoutSession(createServiceClient(), session);
}

async function handleSubscriptionUpdated({ subscription, previousAttributes, eventId }: { subscription: Stripe.Subscription, previousAttributes: unknown, eventId: string }): Promise<void> {
  const paymentStatus = resolvePaymentStatusUpdate(subscription);
  if (!paymentStatus) {
    // Status outside {past_due, unpaid, active} (e.g. `canceled`,
    // `incomplete`) — out of scope for both the renewal and the
    // payment-failed signal.
    return;
  }

  const supabase = createServiceClient();
  const profile = await findProfileByStripeCustomer(supabase, paymentStatus.stripeCustomerId);

  // Code review on PR #101: Stripe doesn't guarantee webhook delivery order,
  // and a customer can have more than one subscription over time (cancel,
  // then resubscribe before the old one's deferred `deleted` event arrives).
  // Matching by customer id alone risks a stale/out-of-order event for a
  // DIFFERENT subscription overwriting this customer's current
  // plan_expires_at -- cross-check the event's subscription id against the
  // one already on file, not just the customer id.
  if (!profile || profile.stripe_subscription_id !== subscription.id) {
    console.error(`[/api/stripe/webhook] no matching user_profiles row for Stripe customer ${paymentStatus.stripeCustomerId} + subscription ${subscription.id} (event ${eventId}) -- likely an out-of-order webhook delivery; self-heals on the next matching event`);
    return;
  }

  if (paymentStatus.kind === 'retrying') {
    // FRESCO-232: charge failed, still within Stripe's own retry window —
    // `plan` is deliberately untouched (stays `'pro'`), only the aviso flag
    // is set.
    await markPaymentFailed(supabase, profile.id);
    // FRESCO-793 (A6-P7): churn-loop signal. Stripe can re-send a `past_due`
    // update while the aviso is already set (any other field change), so only
    // the first failure of a retry cycle counts.
    if (!profile.payment_failed_at) {
      await captureServerEvent({
        distinctId: profile.id,
        event: POSTHOG_EVENTS.PAYMENT_FAILED,
        properties: { stripe_subscription_id: subscription.id },
      });
    }
    return;
  }

  if (paymentStatus.kind === 'exhausted') {
    // FRESCO-232 (AC3): Stripe gave up retrying without necessarily
    // canceling the subscription outright (depends on the account's dunning
    // config — "Cancel subscription" vs. "Mark uncollectible" after retries
    // exhaust). Downgrading here, rather than only reacting to
    // `customer.subscription.deleted`, makes AC3 hold regardless of that
    // dashboard setting.
    await downgradeToFree(supabase, profile.id);
    // FRESCO-366: no subscription_cancelled here — this row keeps its
    // stripe_subscription_id, so the `customer.subscription.deleted` that
    // Stripe sends next (its dunning default) still matches and fires the
    // single cancellation event, with `reason: 'payment_failed'`. Emitting
    // one here too would double-count the same involuntary churn.
    // FRESCO-793: the plan change itself IS this branch, so it carries
    // `plan_downgraded` (and the `deleted` handler skips it, see below).
    if (profile.plan !== 'free') {
      await captureServerEvent({
        distinctId: profile.id,
        event: POSTHOG_EVENTS.PLAN_DOWNGRADED,
        properties: { reason: 'payment_failed', $set: { plan: 'free' } },
      });
    }
    return;
  }

  const priceIds = getProPriceIds();
  if (priceIds.length === 0) {
    throw new Error('No Pro price id is configured (STRIPE_PRICE_ID_PRO_MONTH).');
  }
  const update = resolveRenewalUpdate(subscription, priceIds);

  // FRESCO-232: a renewal-shaped `active` update also means any prior
  // failed-payment aviso just resolved (retry succeeded) -- `applyRenewal`
  // clears it in the same write.
  await applyRenewal(supabase, { profileId: profile.id, planExpiresAt: update.planExpiresAt });

  // FRESCO-366: distinguish the trial converting to its first paid period
  // (`previous_attributes.status === 'trialing'`) from a later renewal / period
  // roll on an already-paying subscription. A recovery from `past_due` is
  // neither — `resolveActiveUpdateFunnelEvent` returns null there.
  const funnelEvent = resolveActiveUpdateFunnelEvent(previousSubscriptionStatus(previousAttributes));
  if (funnelEvent) {
    await captureServerEvent({
      distinctId: profile.id,
      event: funnelEvent,
      properties: {
        stripe_subscription_id: subscription.id,
        $set: { plan: 'pro' },
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const stripeCustomerId = resolveCancellationCustomerId(subscription);
  const supabase = createServiceClient();
  const profile = await findProfileByStripeCustomer(supabase, stripeCustomerId);

  // Same out-of-order-delivery guard as handleSubscriptionUpdated: a
  // `deleted` event for an OLD subscription arriving after the customer
  // resubscribed (new stripe_subscription_id on file) must NOT downgrade a
  // now-legitimately-active Pro customer.
  if (!profile || profile.stripe_subscription_id !== subscription.id) {
    console.error(`[/api/stripe/webhook] no matching user_profiles row for Stripe customer ${stripeCustomerId} + subscription ${subscription.id} (event ${eventId}) -- likely a stale/out-of-order delete for a superseded subscription`);
    return;
  }

  // FRESCO-232: also clears a stale payment-failed aviso -- the account is
  // Free now, the aviso no longer applies.
  await downgradeToFree(supabase, profile.id);

  // FRESCO-366: the paid period actually ended (voluntary cancellation that
  // reached term, or Stripe ended it). `cancellation_details.reason` is
  // `cancellation_requested` | `payment_disputed` | `payment_failed` | null.
  await captureServerEvent({
    distinctId: profile.id,
    event: POSTHOG_EVENTS.SUBSCRIPTION_CANCELLED,
    properties: {
      reason: subscription.cancellation_details?.reason ?? 'unknown',
      $set: { plan: 'free' },
    },
  });

  // FRESCO-793 (A6-P7): the Pro -> Free transition, once. The `unpaid`
  // branch of handleSubscriptionUpdated already downgraded and fired it, so a
  // row that is already Free here must not count a second time.
  if (profile.plan !== 'free') {
    await captureServerEvent({
      distinctId: profile.id,
      event: POSTHOG_EVENTS.PLAN_DOWNGRADED,
      properties: { reason: subscription.cancellation_details?.reason ?? 'unknown', $set: { plan: 'free' } },
    });
  }
}
