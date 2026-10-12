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

/** The claim this worker holds: complete and release only act on a row still stamped with it. */
export interface HeldClaim {
  eventId: string
  claimedAt: string
}

export type ClaimResult
  = | { state: 'claimed', claimedAt: string }
    | { state: 'already_done' }
    | { state: 'in_flight' }
    | { state: 'taken_over', claimedAt: string, claimAgeSeconds: number };

/** Attempts at the insert when the row keeps vanishing between the conflict and the read. */
const MAX_CLAIM_ATTEMPTS = 3;

/**
 * Takes the event for this delivery. `claimed` / `taken_over` mean the caller must run the
 * handler (and carry `claimedAt` to complete / release); `already_done` (an earlier run
 * completed) and `in_flight` (a run is, or may still be, working on it, or another worker
 * just won the takeover) mean it must not. A claim with no completion older than the TTL is
 * retaken with one compare-and-swap on the `claimed_at` it observed, so of several
 * concurrent deliveries exactly one wins. Throws on any other database error: the caller
 * answers 500 and Stripe retries. `now` and `attempt` are for tests and internal retries.
 */
export async function claimWebhookEvent(
  client: Client,
  { eventId, eventType, now = Date.now(), attempt = 1 }: { eventId: string, eventType: string, now?: number, attempt?: number },
): Promise<ClaimResult> {
  const { data: inserted, error } = await client
    .from('stripe_webhook_events')
    .insert({ event_id: eventId, event_type: eventType })
    .select('claimed_at')
    .single();

  if (!error) {
    return { state: 'claimed', claimedAt: inserted.claimed_at };
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
    if (attempt >= MAX_CLAIM_ATTEMPTS) {
      throw new Error(`stripe_webhook_events row ${eventId} keeps vanishing between insert and read`);
    }
    return claimWebhookEvent(client, { eventId, eventType, now, attempt: attempt + 1 });
  }
  if (row.completed_at) {
    return { state: 'already_done' };
  }

  const ageMs = now - new Date(row.claimed_at).getTime();
  if (ageMs < WEBHOOK_CLAIM_TTL_MS) {
    return { state: 'in_flight' };
  }

  const claimedAt = new Date().toISOString();
  const { data: swapped, error: swapError } = await client
    .from('stripe_webhook_events')
    .update({ claimed_at: claimedAt })
    .eq('event_id', eventId)
    .is('completed_at', null)
    .eq('claimed_at', row.claimed_at)
    .select('event_id');
  if (swapError) {
    throw swapError;
  }
  return swapped.length === 1
    ? { state: 'taken_over', claimedAt, claimAgeSeconds: Math.round(ageMs / 1000) }
    : { state: 'in_flight' };
}

/**
 * Marks the event as fully handled, so no later delivery runs it again. Only the claim this
 * worker holds is stamped: a stale worker whose claim was taken over changes nothing.
 * Throws on a write error.
 */
export async function completeWebhookEvent(client: Client, { eventId, claimedAt }: HeldClaim): Promise<void> {
  const { error } = await client
    .from('stripe_webhook_events')
    .update({ completed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('claimed_at', claimedAt);

  if (error) {
    throw error;
  }
}

/**
 * Gives the event back after a failed run, so a resend of it (Stripe or the dashboard) is
 * processed. Only the still-uncompleted claim this worker holds is deleted: a stale worker
 * cannot delete the winner's claim. Throws on a write error.
 */
export async function releaseWebhookEvent(client: Client, { eventId, claimedAt }: HeldClaim): Promise<void> {
  const { error } = await client
    .from('stripe_webhook_events')
    .delete()
    .eq('event_id', eventId)
    .eq('claimed_at', claimedAt)
    .is('completed_at', null);

  if (error) {
    throw error;
  }
}
