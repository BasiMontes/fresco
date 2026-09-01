import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolveReconciledState, stripe } from '@/lib/stripe';
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

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[/api/cron/stripe-reconcile] CRON_SECRET is not configured for this environment');
    return NextResponse.json({ error: 'Job no configurado.' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const proPriceId = process.env.STRIPE_PRICE_ID_PRO_MONTH;
  if (!proPriceId) {
    console.error('[/api/cron/stripe-reconcile] STRIPE_PRICE_ID_PRO_MONTH is not set');
    return NextResponse.json({ error: 'Job no configurado.' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data: profiles, error: loadError } = await supabase
    .from('user_profiles')
    .select('id, plan, plan_expires_at, payment_failed_at, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null);

  if (loadError) {
    console.error('[/api/cron/stripe-reconcile] failed to load user_profiles', loadError);
    return NextResponse.json({ error: 'Error consultando perfiles.' }, { status: 500 });
  }

  let checked = 0;
  let reconciled = 0;
  const drifted: DriftEntry[] = [];

  for (const profile of profiles ?? []) {
    const subscriptionId = profile.stripe_subscription_id;
    if (!subscriptionId) {
      continue;
    }
    checked++;

    let target: ReturnType<typeof resolveReconciledState>;
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      target = resolveReconciledState(subscription, proPriceId);
    }
    catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        // The subscription no longer exists in Stripe — treat exactly like a
        // `customer.subscription.deleted` the webhook never received.
        target = { action: 'downgrade' };
      }
      else {
        console.error(`[/api/cron/stripe-reconcile] failed to retrieve subscription ${subscriptionId} for user ${profile.id}`, error);
        continue;
      }
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

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(desired)
      .eq('id', profile.id);

    if (updateError) {
      console.error(`[/api/cron/stripe-reconcile] failed to reconcile user ${profile.id}`, updateError);
      continue;
    }

    reconciled++;
    drifted.push({ userId: profile.id, changes });
    console.warn(`[/api/cron/stripe-reconcile] reconciled user ${profile.id}`, JSON.stringify(changes));
  }

  const sweptOrphans = await sweepOrphanPaidPlans(supabase);

  return NextResponse.json({ checked, reconciled, drifted, sweptOrphans });
}

/**
 * FRESCO-360: the second safety net behind the `protect_subscription_columns`
 * INSERT guard. Any `user_profiles` row that claims a paid plan but carries no
 * `stripe_subscription_id` was never created by the Stripe webhook (the only
 * writer of subscription state, ADR-0007) — most likely a row planted by the
 * A4-B1 client-INSERT bypass. Downgrade it to `free`. Shape mirrors the
 * webhook's `customer.subscription.deleted` handler: flip `plan`, clear the
 * payment-failed aviso, leave `plan_expires_at` as-is. Returns the row count.
 *
 * The main reconcile loop above filters on `stripe_subscription_id IS NOT NULL`
 * and never sees these rows.
 */
export async function sweepOrphanPaidPlans(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data: orphans, error } = await supabase
    .from('user_profiles')
    .select('id, plan')
    .in('plan', ['pro', 'family'])
    .is('stripe_subscription_id', null);

  if (error) {
    console.error('[/api/cron/stripe-reconcile] failed to load orphan pro/family rows', error);
    return 0;
  }

  let swept = 0;
  for (const orphan of orphans ?? []) {
    const { error: downgradeError } = await supabase
      .from('user_profiles')
      .update({ plan: 'free', payment_failed_at: null })
      .eq('id', orphan.id);

    if (downgradeError) {
      console.error(`[/api/cron/stripe-reconcile] failed to sweep orphan row ${orphan.id}`, downgradeError);
      continue;
    }

    swept++;
    console.warn(`[/api/cron/stripe-reconcile] swept orphan ${orphan.plan} row with no Stripe subscription`, orphan.id);
  }

  return swept;
}
