import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { SubscriptionConfirmationEmailParams } from '@/lib/email/templates/subscription-confirmation';
import type { Database } from '@/lib/supabase/types';
import * as Sentry from '@sentry/nextjs';
import { isEndedSubscription, isTransientStripeError, retrieveLiveSubscription } from '@/lib/billing/stripe-errors';
import { sendSubscriptionConfirmationEmail } from '@/lib/email/resend';
import { PRO_TRIAL_DAYS } from '@/lib/legal/pro-terms';
import { resolveAppUrl } from '@/lib/stripe';

type Client = SupabaseClient<Database>;

/**
 * FRESCO-1005 (audit 7b: A7-LAUNCH-01, A7-LAUNCH-02, A7-OPS-03) — the subscription confirmation
 * email a consumer must receive (TRLGDCU art. 98.7), made impossible to lose in silence.
 *
 * While the sender is `onboarding@resend.dev` (no verified domain, FRESCO-886) Resend delivers
 * only to the account owner, so a real customer's send is rejected. That used to be a
 * `console.error`. Now a rejected send is reported to Sentry under the tag below and leaves a
 * row in `pending_confirmation_emails`, which `stripe-reconcile` retries until the cap.
 * Retrying cannot succeed before the domain exists; what it buys is that the first retry after
 * the domain is verified delivers the backlog, and that the failure is loud meanwhile.
 */

/** Sentry tag every failure of this email carries: `email: subscription-confirmation`. */
const CONFIRMATION_EMAIL_SENTRY_TAG = 'subscription-confirmation';

/**
 * Attempts, the first send included, before a pending row is left alone. The cron runs once a
 * day, so this is five days of retries; past it the row stays for an operator to see and the
 * cron stops raising an alert for it every night.
 */
export const CONFIRMATION_EMAIL_MAX_ATTEMPTS = 5;

/** Rows a single cron pass retries; the rest wait for the next pass. */
const RETRY_BATCH_SIZE = 50;

const MAX_ERROR_LENGTH = 500;

// FRESCO-429 (TRLGDCU art. 98.7): formats the actual amount Stripe charges — no separate VAT
// line is invented, since this checkout has no `automatic_tax` configured to compute one.
// FRESCO-1004: "IVA incluido" is added next to it only when the Price is tax-inclusive.
function formatChargedAmount(unitAmount: number | null | undefined, currency: string | undefined): string {
  const amount = (unitAmount ?? 0) / 100;
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: (currency ?? 'eur').toUpperCase() }).format(amount);
}

function formatChargeDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * What the email says, read from the subscription as Stripe has it: the price of one period, the
 * period (`month` / `year`), the date of the next charge and, while it is in its free trial, the
 * trial length. Used by the first send and by every retry, so both say the same thing.
 */
export function confirmationEmailContent(subscription: Stripe.Subscription): Omit<SubscriptionConfirmationEmailParams, 'manageSubscriptionUrl'> {
  const item = subscription.items.data[0];
  const trialing = subscription.status === 'trialing';
  const nextChargeSeconds = trialing ? subscription.trial_end : item?.current_period_end;
  if (!nextChargeSeconds) {
    throw new Error(`Subscription ${subscription.id} has no ${trialing ? 'trial_end' : 'current_period_end'}: cannot say when the next charge is.`);
  }

  return {
    priceFormatted: formatChargedAmount(item?.price.unit_amount, item?.price.currency),
    interval: item?.price.recurring?.interval === 'year' ? 'year' : 'month',
    taxIncluded: item?.price.tax_behavior === 'inclusive',
    nextRenewalDateFormatted: formatChargeDate(nextChargeSeconds),
    ...(trialing ? { trialDays: PRO_TRIAL_DAYS } : {}),
  };
}

/** The email of an auth user, or the reason it could not be read. Never throws. */
export async function lookupUserEmail(client: Client, userId: string): Promise<{ email: string | undefined, error: unknown }> {
  try {
    const { data, error } = await client.auth.admin.getUserById(userId);
    return { email: error ? undefined : data?.user?.email, error };
  }
  catch (error) {
    return { email: undefined, error };
  }
}

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
}

function reportFailure({ message, error, extra }: { message: string, error: unknown, extra: Record<string, unknown> }): void {
  console.error(`[confirmation-email] ${message}`, error);
  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    tags: { email: CONFIRMATION_EMAIL_SENTRY_TAG },
    extra: { message, ...extra },
  });
}

async function sendConfirmation(subscription: Stripe.Subscription, to: string): Promise<void> {
  await sendSubscriptionConfirmationEmail({
    to,
    ...confirmationEmailContent(subscription),
    manageSubscriptionUrl: `${resolveAppUrl()}/profile`,
  });
}

/**
 * Sends the confirmation for a subscription that was just granted. NEVER throws: the
 * subscription is already active and a failed email must not undo it (AC3 of FRESCO-429). A
 * failure is reported to Sentry and leaves a pending row for the cron to retry.
 */
export async function deliverSubscriptionConfirmation(
  client: Client,
  { userId, subscription, email, emailLookupError }: { userId: string, subscription: Stripe.Subscription, email: string | undefined, emailLookupError: unknown },
): Promise<void> {
  try {
    if (!email) {
      throw emailLookupError ?? new Error('no email on file for this user');
    }
    await sendConfirmation(subscription, email);
  }
  catch (error) {
    reportFailure({ message: `subscription confirmation email failed for user ${userId} (subscription ${subscription.id})`, error, extra: { user_id: userId, stripe_subscription_id: subscription.id } });
    await recordPendingConfirmation(client, { userId, subscriptionId: subscription.id, error });
  }
}

/** Leaves the retry row. The first failure inserts it; a replay of the same subscription never resets the attempts. */
async function recordPendingConfirmation(client: Client, { userId, subscriptionId, error }: { userId: string, subscriptionId: string, error: unknown }): Promise<void> {
  try {
    const { error: insertError } = await client
      .from('pending_confirmation_emails')
      .upsert({ subscription_id: subscriptionId, user_id: userId, last_error: describeError(error) }, { onConflict: 'subscription_id', ignoreDuplicates: true });
    if (insertError) {
      throw insertError;
    }
  }
  catch (recordError) {
    // The failure itself is already in Sentry; this one says the retry will not happen.
    reportFailure({ message: `could not record the pending confirmation email for subscription ${subscriptionId}`, error: recordError, extra: { user_id: userId, stripe_subscription_id: subscriptionId } });
  }
}

export interface ConfirmationRetryResult {
  /** Rows picked up this pass. */
  tried: number
  sent: number
  /** Sends that failed again (the row stays, one attempt older). */
  failed: number
  /** Rows that reached the attempt cap on this pass. */
  gaveUp: number
  /** Rows deleted because their subscription is over or Stripe no longer has it. */
  dropped: number
  /** Rows left untouched because Stripe was unavailable. */
  skipped: number
}

/**
 * Retries the pending confirmations that are still under the attempt cap. Called by
 * `stripe-reconcile`. Throws only when the pending rows cannot be listed; each row is handled on
 * its own, so one bad row never stops the others.
 */
export async function retryPendingConfirmations(client: Client, stripe: Pick<Stripe, 'subscriptions'>): Promise<ConfirmationRetryResult> {
  const result: ConfirmationRetryResult = { tried: 0, sent: 0, failed: 0, gaveUp: 0, dropped: 0, skipped: 0 };

  const { data: rows, error } = await client
    .from('pending_confirmation_emails')
    .select('subscription_id, user_id, attempts')
    .lt('attempts', CONFIRMATION_EMAIL_MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(RETRY_BATCH_SIZE);
  if (error) {
    throw error;
  }

  for (const row of rows) {
    result.tried++;
    try {
      const subscription = await retrieveLiveSubscription(stripe, row.subscription_id);
      if (!subscription || isEndedSubscription(subscription)) {
        await deletePending(client, row.subscription_id);
        result.dropped++;
        continue;
      }

      const { email, error: lookupError } = await lookupUserEmail(client, row.user_id);
      try {
        if (!email) {
          throw lookupError ?? new Error('no email on file for this user');
        }
        await sendConfirmation(subscription, email);
      }
      catch (sendError) {
        const attempts = row.attempts + 1;
        await recordFailedRetry(client, { subscriptionId: row.subscription_id, attempts, error: sendError });
        result.failed++;
        if (attempts >= CONFIRMATION_EMAIL_MAX_ATTEMPTS) {
          result.gaveUp++;
          reportFailure({ message: `giving up on the confirmation email of subscription ${row.subscription_id} after ${attempts} attempts`, error: sendError, extra: { user_id: row.user_id, stripe_subscription_id: row.subscription_id, attempts } });
        }
        continue;
      }

      await deletePending(client, row.subscription_id);
      result.sent++;
    }
    catch (rowError) {
      if (isTransientStripeError(rowError)) {
        result.skipped++;
        continue;
      }
      result.failed++;
      reportFailure({ message: `could not retry the confirmation email of subscription ${row.subscription_id}`, error: rowError, extra: { stripe_subscription_id: row.subscription_id } });
    }
  }

  return result;
}

async function deletePending(client: Client, subscriptionId: string): Promise<void> {
  const { error } = await client.from('pending_confirmation_emails').delete().eq('subscription_id', subscriptionId);
  if (error) {
    throw error;
  }
}

async function recordFailedRetry(client: Client, { subscriptionId, attempts, error }: { subscriptionId: string, attempts: number, error: unknown }): Promise<void> {
  const { error: updateError } = await client
    .from('pending_confirmation_emails')
    .update({ attempts, last_error: describeError(error), last_attempt_at: new Date().toISOString() })
    .eq('subscription_id', subscriptionId);
  if (updateError) {
    throw updateError;
  }
}
