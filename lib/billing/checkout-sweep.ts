import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/supabase/types';
import { grantProFromCheckoutSession } from '@/lib/billing/grant-pro';
import { getStoredSubscriptionId } from '@/lib/billing/subscription';
import { stripe } from '@/lib/stripe';

type Client = SupabaseClient<Database>;

/** How far back the sweep looks. The cron runs daily, so 48 h leaves one missed run of margin. */
const SWEEP_WINDOW_HOURS = 48;

export interface CheckoutSweepResult {
  /** Completed subscription sessions looked at (one per user: the newest). */
  scanned: number
  /** Sessions whose Pro grant was missing and has now been written. */
  granted: number
  /** Sessions the grant refused or that errored; they are logged and retried on the next run. */
  failed: number
}

/** Seams for tests: the real Stripe client and the real grant by default. */
interface SweepDeps {
  stripeClient?: Pick<Stripe, 'checkout'>
  grant?: typeof grantProFromCheckoutSession
}

function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  if (!session.subscription) {
    return null;
  }
  return typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
}

/**
 * FRESCO-909 (audit C-03): the inverse sweep of the reconcile cron. The main
 * loop starts from `user_profiles` rows that already carry a subscription, so it
 * can never see a customer who paid and whose webhook never landed (the event was
 * lost, or its claim was left open by a dead worker): that row has no
 * `stripe_subscription_id` yet. This starts from Stripe instead: it lists the
 * subscription Checkout Sessions completed in the last 48 h and grants Pro, through
 * the same `grantProFromCheckoutSession` the webhook uses, to any user whose stored
 * subscription is not the one they just paid for.
 *
 * Safe to run unconditionally: the grant itself refuses an unsettled payment, a
 * subscription that is no longer trialing or active, and a non-Pro price. Only the
 * newest session per user is considered (Stripe lists newest first), so an older
 * session never overwrites a later subscription. A user whose stored id already
 * matches is skipped, which also leaves a deliberately downgraded row alone.
 *
 * Fail-soft: a session that errors is counted and logged, never stops the rest.
 * Only the Stripe listing itself can throw.
 */
export async function sweepPaidCheckoutsWithoutPro(client: Client, deps: SweepDeps = {}): Promise<CheckoutSweepResult> {
  const { stripeClient = stripe, grant = grantProFromCheckoutSession } = deps;
  const since = Math.floor(Date.now() / 1000) - SWEEP_WINDOW_HOURS * 3600;
  const seenUsers = new Set<string>();
  const result: CheckoutSweepResult = { scanned: 0, granted: 0, failed: 0 };

  for await (const session of stripeClient.checkout.sessions.list({ created: { gte: since }, limit: 100 })) {
    const userId = session.client_reference_id;
    const subscriptionId = subscriptionIdOf(session);
    if (session.mode !== 'subscription' || session.status !== 'complete' || !userId || !subscriptionId || seenUsers.has(userId)) {
      continue;
    }
    seenUsers.add(userId);
    result.scanned++;

    try {
      if (await getStoredSubscriptionId(client, userId) === subscriptionId) {
        continue;
      }
      await grant(client, session);
      result.granted++;
      console.warn(`[/api/cron/stripe-reconcile] granted Pro to user ${userId} from a paid checkout session the webhook never applied (subscription ${subscriptionId})`);
    }
    catch (error) {
      result.failed++;
      console.error(`[/api/cron/stripe-reconcile] could not recover checkout session ${session.id} for user ${userId}`, error);
    }
  }

  return result;
}
