import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

/** Postgres `unique_violation`: the event id is already on file. */
const UNIQUE_VIOLATION = '23505';

/**
 * Idempotency key of `POST /api/stripe/webhook` (FRESCO-816, audit-6 A6-S10): one row per
 * Stripe `event.id`. The table is closed to every client role, so these take the
 * service-role client.
 */

/**
 * Takes the event for this delivery. `true` when it was free, `false` when an earlier
 * delivery already holds it (so this one must not run the handler again). Throws on any
 * other database error: the caller answers 500 and Stripe retries.
 */
export async function claimWebhookEvent(client: Client, { eventId, eventType }: { eventId: string, eventType: string }): Promise<boolean> {
  const { error } = await client
    .from('stripe_webhook_events')
    .insert({ event_id: eventId, event_type: eventType });

  if (!error) {
    return true;
  }
  if (error.code === UNIQUE_VIOLATION) {
    return false;
  }
  throw error;
}

/** Gives the event back after a failed run, so a resend of it (Stripe or the dashboard) is processed. Throws on a write error. */
export async function releaseWebhookEvent(client: Client, eventId: string): Promise<void> {
  const { error } = await client
    .from('stripe_webhook_events')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    throw error;
  }
}
