import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { downgradeToFree } from '@/lib/billing/subscription';
import { readAllPages } from '@/lib/supabase/read-all-pages';

type Client = SupabaseClient<Database>;
type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

/** The columns the reconciliation job compares against Stripe. */
export type ReconcilableProfile = Pick<UserProfileRow, 'id' | 'plan' | 'plan_expires_at' | 'payment_failed_at' | 'stripe_subscription_id' | 'stripe_customer_id' | 'stripe_livemode'>;

/** What the job writes when a row drifted: `plan_expires_at` is only asserted on the Pro path. */
export interface DesiredBillingState {
  plan: 'free' | 'pro'
  payment_failed_at: string | null
  plan_expires_at?: string
}

/**
 * Table access of `app/api/cron/stripe-reconcile/route.ts` (ADR-0015), moved
 * by FRESCO-810 (ADR-0041). The route keeps the Stripe comparison.
 */

/**
 * Every profile that carries a Stripe subscription. Throws on a read error.
 * FRESCO-1165: read a page at a time (ordered by `id`), because PostgREST caps one response at `max_rows` (1000)
 * and the rows past it were never reconciled.
 */
export async function listSubscribedProfiles(client: Client): Promise<ReconcilableProfile[]> {
  return readAllPages<ReconcilableProfile>(
    (from, to) => client
      .from('user_profiles')
      .select('id, plan, plan_expires_at, payment_failed_at, stripe_subscription_id, stripe_customer_id, stripe_livemode')
      .not('stripe_subscription_id', 'is', null)
      .order('id')
      .range(from, to),
    'could not list the profiles with a Stripe subscription',
  );
}

/** Writes the desired state onto one drifted row. Throws on a write error. */
export async function applyReconciledState(client: Client, { profileId, desired }: { profileId: string, desired: DesiredBillingState }): Promise<void> {
  const { error } = await client
    .from('user_profiles')
    .update(desired)
    .eq('id', profileId);

  if (error) {
    throw error;
  }
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
 * The main reconcile loop filters on `stripe_subscription_id IS NOT NULL` and
 * never sees these rows. Fail-soft on purpose: a load error returns 0 and a
 * failed row is skipped, so one bad row never blocks the rest.
 */
export async function sweepOrphanPaidPlans(client: Client): Promise<number> {
  // FRESCO-1165: every orphan, not the first `max_rows`; the whole list is read before any row is downgraded.
  let orphans: { id: string, plan: string }[];
  try {
    orphans = await readAllPages<{ id: string, plan: string }>(
      (from, to) => client
        .from('user_profiles')
        .select('id, plan')
        .in('plan', ['pro', 'family'])
        .is('stripe_subscription_id', null)
        .order('id')
        .range(from, to),
      'could not load the orphan pro/family rows',
    );
  }
  catch (error) {
    console.error('[/api/cron/stripe-reconcile] failed to load orphan pro/family rows', error);
    return 0;
  }

  let swept = 0;
  for (const orphan of orphans) {
    try {
      await downgradeToFree(client, orphan.id);
    }
    catch (downgradeError) {
      console.error(`[/api/cron/stripe-reconcile] failed to sweep orphan row ${orphan.id}`, downgradeError);
      continue;
    }

    swept++;
    console.warn(`[/api/cron/stripe-reconcile] swept orphan ${orphan.plan} row with no Stripe subscription`, orphan.id);
  }

  return swept;
}
