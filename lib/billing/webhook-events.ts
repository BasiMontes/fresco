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
 * How long a claim without a completion is trusted (FRESCO-909, audit C-03). It must stay
 * well above the route's `maxDuration` (60 s): a run that is still alive can never be
 * retaken. A claim older than this belongs to a run that died, and the next delivery
 * takes it over.
 */
export const WEBHOOK_CLAIM_TTL_MS = 5 * 60 * 1000;

export type ClaimResult
  = | { state: 'claimed' }
    | { state: 'already_done' }
    | { state: 'in_flight' }
    | { state: 'taken_over', claimAgeSeconds: number };

/**
 * Takes the event for this delivery. `claimed` / `taken_over` mean the caller must run the
 * handler; `already_done` (an earlier run completed) and `in_flight` (a run is, or may
 * still be, working on it) mean it must not. A claim with no completion older than
 * `WEBHOOK_CLAIM_TTL_MS` is retaken with one compare-and-swap on the `claimed_at` it
 * observed, so of several concurrent deliveries exactly one wins. Throws on any other
 * database error: the caller answers 500 and Stripe retries.
 */
export async function claimWebhookEvent(client: Client, { eventId, eventType }: { eventId: string, eventType: string }): Promise<ClaimResult> {
  const { error } = await client
    .from('stripe_webhook_events')
    .insert({ event_id: eventId, event_type: eventType });

  if (!error) {
    return { state: 'claimed' };
  }
  if (error.code !== UNIQUE_VIOLATION) {
    throw error;
  }

  const { data: row, error: readError } = await client
    .from('stripe_webhook_events')
    .select('claimed_at, completed_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError) {
    throw readError;
  }
  if (!row) {
    // Released between our insert and our read: the event is free again.
    return claimWebhookEvent(client, { eventId, eventType });
  }
  if (row.completed_at) {
    return { state: 'already_done' };
  }

  const ageMs = Date.now() - new Date(row.claimed_at).getTime();
  if (ageMs < WEBHOOK_CLAIM_TTL_MS) {
    return { state: 'in_flight' };
  }

  const { data: swapped, error: swapError } = await client
    .from('stripe_webhook_events')
    .update({ claimed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .is('completed_at', null)
    .eq('claimed_at', row.claimed_at)
    .select('event_id');
  if (swapError) {
    throw swapError;
  }
  return swapped.length === 1
    ? { state: 'taken_over', claimAgeSeconds: Math.round(ageMs / 1000) }
    : { state: 'in_flight' };
}

/** Marks the event as fully handled, so no later delivery runs it again. Throws on a write error. */
export async function completeWebhookEvent(client: Client, eventId: string): Promise<void> {
  const { error } = await client
    .from('stripe_webhook_events')
    .update({ completed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (error) {
    throw error;
  }
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
