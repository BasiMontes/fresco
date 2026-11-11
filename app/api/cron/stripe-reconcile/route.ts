import type { CheckoutSweepResult } from '@/lib/billing/checkout-sweep';
import type { ConfirmationRetryResult } from '@/lib/billing/confirmation-email';
import type { ReconcilableProfile } from '@/lib/billing/reconcile';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { timingSafeEqual } from '@/lib/auth/timing-safe-equal';
import { sweepPaidCheckoutsWithoutPro } from '@/lib/billing/checkout-sweep';
import { retryPendingConfirmations } from '@/lib/billing/confirmation-email';
import { applyReconciledState, listSubscribedProfiles, sweepOrphanPaidPlans } from '@/lib/billing/reconcile';
import { environmentLivemode, readDatabaseLivemode } from '@/lib/billing/stripe-mode';
import { profileHoldsOtherMode } from '@/lib/billing/subscription';
import { recordJobHeartbeat, STRIPE_RECONCILE_JOB } from '@/lib/jobs/heartbeat';
import { getProPriceIds, resolveReconciledState, stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/cron/stripe-reconcile — the reconciliation job for ADR-0015.
 *
 * ADR-0007 makes `POST /api/stripe/webhook` the ONLY writer of subscription
 * state (`plan` / `plan_expires_at` / `payment_failed_at`). If a webhook
 * delivery is ever lost or fails silently, `user_profiles` diverges from
 * Stripe with nobody watching. This route is the drift-correcting second
 * write path: it derives the target state from the live Stripe subscription
 * (`resolveReconciledState`, the same helpers the webhook uses) and writes
 * only the rows that actually differ.
 *
 * Triggered exclusively by `pg_cron` + `pg_net` (see the
 * `schedule_stripe_reconciliation` migration) — never by a browser. The
 * caller proves it is that job by presenting `Authorization: Bearer
 * <CRON_SECRET>`; `CRON_SECRET` is a plain shared secret (not a Supabase
 * key), set in the Vercel Production scope and mirrored into Supabase Vault
 * for the migration to read. Because one Supabase project backs all three
 * environments, the cron fires once and targets the production app URL only.
 *
 * Idempotent and read-mostly: with healthy webhooks it writes 0 rows per
 * run. It never grants Pro for a non-Pro price and never rewrites
 * `stripe_customer_id` / `stripe_subscription_id` (matches the webhook's
 * `customer.subscription.deleted` handler, which keeps the ids for history).
 *
 * FRESCO-909 (audit C-03): the loop above only sees rows that already carry a
 * subscription, so it cannot find a customer who paid while the webhook never landed.
 * `sweepPaidCheckoutsWithoutPro` runs last and starts from Stripe instead: paid Checkout
 * Sessions of the last 48 h whose user has not got that subscription on file. It grants
 * through the webhook's own `grantProFromCheckoutSession`, so every guard travels with it.
 *
 * FRESCO-1005 (audit 7b): after the sweep, the subscription confirmation emails that Resend rejected
 * (`pending_confirmation_emails`) are retried, up to a cap. Fail-soft like the sweep.
 *
 * FRESCO-915 (audit C-11): `cron.job_run_details` says `succeeded` even when this route answers
 * 401 or 500 (`net.http_get` only enqueues), and this is the only safety net for lost payments. So
 * a pass that gets to the end writes its own heartbeat (`job_heartbeat`), which a monitor reads,
 * and the errors that stop or degrade a pass go to Sentry instead of only the console. A pass in
 * which Stripe answered for none of the profiles does not count as a success.
 *
 * FRESCO-1088 (audit 8: A8-PAY-03): a key of the other Stripe mode answers `resource_missing` for
 * every subscription, which the loop below would read as "ended" and downgrade paying customers
 * (the documented rollback, test keys with `billing_mode` false, does exactly that). So the pass
 * (1) refuses to act at all unless the mode of `STRIPE_SECRET_KEY` equals `billing_mode`
 * (ADR-0061), and (2) downgrades on `resource_missing` only after the customer is seen to still
 * exist in Stripe; otherwise it counts a failure and leaves the plan alone.
 *
 * FRESCO-1161 (audit: PAY-N1): a profile whose Stripe ids are of the OTHER mode than `billing_mode`
 * (a test-mode trial when the database goes live) is not looked up in Stripe at all: the live key
 * can never find it, so it used to fail every pass and stay Pro for good. The pass downgrades it to
 * Free and keeps its ids (the person pays through a clean live customer and, the ids marking the
 * trial as used, without a second free trial). It is counted under `foreignMode`, not as a failure.
 */

export const dynamic = 'force-dynamic';

interface DriftEntry {
  userId: string
  changes: Record<string, { from: unknown, to: unknown }>
}

/** Postgres `timestamptz` round-trips as an offset string; compare as instants, not raw text. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return new Date(a).getTime() === new Date(b).getTime();
}

const SENTRY_TAGS = { cron_job: STRIPE_RECONCILE_JOB };

/** Console line plus a Sentry event: a stopped or degraded pass must not be visible only in the logs. */
function reportFailure(message: string, error: unknown): void {
  console.error(`[/api/cron/stripe-reconcile] ${message}`, error);
  Sentry.captureException(error instanceof Error ? error : new Error(message), { tags: SENTRY_TAGS, extra: { message } });
}

/** FRESCO-1005: fail-soft, a retry error must not turn the reconcile pass into a 500. */
async function retryConfirmationEmails(supabase: ReturnType<typeof createServiceClient>): Promise<ConfirmationRetryResult | null> {
  try {
    return await retryPendingConfirmations(supabase, stripe);
  }
  catch (retryError) {
    reportFailure('confirmation email retry pass failed', retryError);
    return null;
  }
}

/**
 * FRESCO-1088: the mode the pass serves, or a 500 response when the key's Stripe mode is not the mode
 * the database serves (or either cannot be established). Fails closed: an unknown mode is a refusal.
 */
async function establishStripeMode(supabase: ReturnType<typeof createServiceClient>): Promise<{ livemode: boolean } | { refusal: NextResponse }> {
  const refusal = { refusal: NextResponse.json({ error: 'Job no configurado.' }, { status: 500 }) };
  try {
    const environment = environmentLivemode();
    const database = await readDatabaseLivemode(supabase);
    if (environment === database) {
      return { livemode: database };
    }
    const mode = (livemode: boolean) => (livemode ? 'live' : 'test');
    reportFailure('Stripe mode mismatch, the pass did nothing', new Error(`STRIPE_SECRET_KEY is a ${mode(environment)}-mode key but billing_mode serves ${mode(database)} mode`));
  }
  catch (modeError) {
    reportFailure('could not establish the Stripe mode, the pass did nothing', modeError);
  }
  return refusal;
}

/**
 * FRESCO-1161: a profile that holds Stripe ids of the other mode cannot be settled with this key, so it
 * is not asked about: it is taken off Pro (and its payment-failed aviso cleared), keeping every id.
 * A write error is reported and counted apart from the Stripe failures.
 */
async function settleForeignModeProfile({ supabase, profile, counts }: { supabase: ReturnType<typeof createServiceClient>, profile: ReconcilableProfile, counts: { downgraded: number, failed: number } }): Promise<void> {
  if (profile.plan === 'free' && profile.payment_failed_at === null) {
    return;
  }
  try {
    await applyReconciledState(supabase, { profileId: profile.id, desired: { plan: 'free', payment_failed_at: null } });
    counts.downgraded++;
    console.warn(`[/api/cron/stripe-reconcile] user ${profile.id} holds Stripe ids of the other mode than billing_mode: set to free, ids kept`);
  }
  catch (error) {
    counts.failed++;
    reportFailure(`failed to take user ${profile.id} (Stripe ids of the other mode) off Pro`, error);
  }
}

/** FRESCO-1088: a missing subscription only means "ended" if Stripe still knows the customer. */
async function customerStillInStripe(customerId: string | null): Promise<boolean> {
  if (!customerId) {
    return false;
  }
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !('deleted' in customer && customer.deleted);
  }
  catch {
    return false;
  }
}

type Target = ReturnType<typeof resolveReconciledState>;

/**
 * The state Stripe says a profile should be in, or 'failed' (already reported to Sentry) when it
 * cannot be told. FRESCO-1088: a missing subscription counts as ended, exactly like a
 * `customer.subscription.deleted` the webhook never received, only when Stripe still knows the
 * customer; otherwise the key does not see this data and the profile keeps its plan.
 */
async function resolveTarget(profile: ReconcilableProfile, proPriceIds: string[]): Promise<Target | 'failed'> {
  const subscriptionId = profile.stripe_subscription_id ?? '';
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return resolveReconciledState(subscription, proPriceIds);
  }
  catch (error) {
    if (!(error instanceof Stripe.errors.StripeError && error.code === 'resource_missing')) {
      reportFailure(`failed to retrieve subscription ${subscriptionId} for user ${profile.id}`, error);
      return 'failed';
    }
    if (await customerStillInStripe(profile.stripe_customer_id)) {
      return { action: 'downgrade' };
    }
    reportFailure(`subscription ${subscriptionId} is missing and its customer could not be confirmed, user ${profile.id} keeps their plan`, error);
    return 'failed';
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    reportFailure('CRON_SECRET is not configured for this environment', new Error('CRON_SECRET is not configured'));
    return NextResponse.json({ error: 'Job no configurado.' }, { status: 500 });
  }

  // FRESCO-816 (A6-S8): constant-time, so the response time never says how much of a guess was right.
  if (!timingSafeEqual(request.headers.get('authorization') ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const proPriceIds = getProPriceIds();
  if (proPriceIds.length === 0) {
    reportFailure('STRIPE_PRICE_ID_PRO_MONTH is not set', new Error('STRIPE_PRICE_ID_PRO_MONTH is not set'));
    return NextResponse.json({ error: 'Job no configurado.' }, { status: 500 });
  }

  const supabase = createServiceClient();

  const mode = await establishStripeMode(supabase);
  if ('refusal' in mode) {
    return mode.refusal;
  }

  let profiles: ReconcilableProfile[];
  try {
    profiles = await listSubscribedProfiles(supabase);
  }
  catch (loadError) {
    reportFailure('failed to load user_profiles', loadError);
    return NextResponse.json({ error: 'Error consultando perfiles.' }, { status: 500 });
  }

  let checked = 0;
  let failures = 0;
  let reconciled = 0;
  const foreignMode = { downgraded: 0, failed: 0 };
  const drifted: DriftEntry[] = [];

  for (const profile of profiles) {
    const subscriptionId = profile.stripe_subscription_id;
    if (!subscriptionId) {
      continue;
    }

    // FRESCO-1161: before any Stripe call, and outside `checked`/`failures`: Stripe is not asked about
    // these rows, so they say nothing about whether Stripe answered.
    if (profileHoldsOtherMode(profile, mode.livemode)) {
      await settleForeignModeProfile({ supabase, profile, counts: foreignMode });
      continue;
    }
    checked++;

    const target = await resolveTarget(profile, proPriceIds);
    if (target === 'failed') {
      failures++;
      continue;
    }

    if (target.action === 'skip') {
      console.warn(`[/api/cron/stripe-reconcile] skipped user ${profile.id}: ${target.reason}`);
      continue;
    }

    // `plan_expires_at` is only asserted on the `pro` path. On downgrade the
    // reconciler mirrors the webhook's `customer.subscription.deleted`
    // handler exactly — it flips `plan` + clears the aviso and leaves
    // `plan_expires_at` as-is, so the two writers never disagree.
    const desired: { plan: 'free' | 'pro', payment_failed_at: string | null, plan_expires_at?: string }
      = target.action === 'downgrade'
        ? { plan: 'free', payment_failed_at: null }
        : {
            plan: 'pro',
            plan_expires_at: target.planExpiresAt,
            // Keep the original aviso timestamp if one is already set — only
            // stamp a fresh one when the row has none (mirrors the webhook's
            // `retrying` branch, which never overwrites an existing value).
            payment_failed_at: target.paymentFailed
              ? profile.payment_failed_at ?? new Date().toISOString()
              : null,
          };

    const changes: DriftEntry['changes'] = {};
    if (profile.plan !== desired.plan) {
      changes.plan = { from: profile.plan, to: desired.plan };
    }
    if (desired.plan_expires_at !== undefined && !sameInstant(profile.plan_expires_at, desired.plan_expires_at)) {
      changes.plan_expires_at = { from: profile.plan_expires_at, to: desired.plan_expires_at };
    }
    if (!sameInstant(profile.payment_failed_at, desired.payment_failed_at)) {
      changes.payment_failed_at = { from: profile.payment_failed_at, to: desired.payment_failed_at };
    }

    if (Object.keys(changes).length === 0) {
      continue;
    }

    try {
      await applyReconciledState(supabase, { profileId: profile.id, desired });
    }
    catch (updateError) {
      failures++;
      reportFailure(`failed to reconcile user ${profile.id}`, updateError);
      continue;
    }

    reconciled++;
    drifted.push({ userId: profile.id, changes });
    console.warn(`[/api/cron/stripe-reconcile] reconciled user ${profile.id}`, JSON.stringify(changes));
  }

  const sweptOrphans = await sweepOrphanPaidPlans(supabase);

  // FRESCO-909 (audit C-03): the inverse direction. Fail-soft like the orphan sweep: a
  // Stripe listing error must not turn the reconcile run above into a 500.
  let checkoutSweep: CheckoutSweepResult | null = null;
  try {
    checkoutSweep = await sweepPaidCheckoutsWithoutPro(supabase);
  }
  catch (sweepError) {
    reportFailure('paid-checkout sweep failed', sweepError);
  }

  const confirmationRetries = await retryConfirmationEmails(supabase);

  // FRESCO-915: the heartbeat means "this pass ran", so it is not written when Stripe answered for
  // none of the profiles checked (an outage looks like a clean pass otherwise). One row that keeps
  // failing does not stop it; that would raise a false alarm forever.
  const stripeAnsweredNone = checked > 0 && failures === checked;
  if (!stripeAnsweredNone) {
    try {
      await recordJobHeartbeat(supabase, STRIPE_RECONCILE_JOB);
    }
    catch (heartbeatError) {
      reportFailure('could not write the job heartbeat', heartbeatError);
    }
  }

  return NextResponse.json({ checked, reconciled, drifted, foreignMode, sweptOrphans, checkoutSweep, confirmationRetries, failures });
}
