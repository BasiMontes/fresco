import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export class PushSubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushSubscriptionError';
  }
}

/** The three fields `PushSubscription.toJSON()` gives us, mapped 1:1 onto the `push_subscriptions` columns (PR1 migration). */
export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * What `savePushSubscription` found: `saved` (a new row), `owned` (this browser's endpoint was already stored
 * for THIS user) or `taken` (the endpoint belongs to ANOTHER user: a shared browser where the previous person
 * never removed their subscription). FRESCO-1182.
 */
export type SavePushSubscriptionResult = 'saved' | 'owned' | 'taken';

/**
 * Persists a browser push subscription for the CURRENTLY authenticated user
 * (FRESCO-241 PR2). `push_subscriptions` has no UPDATE RLS policy by design
 * (PR1 migration: "a subscription is replaced (delete + insert) rather than
 * edited") — so a plain `insert` is used.
 *
 * A `23505` unique-violation on `endpoint` means the browser already has a row, and whose it is
 * matters (FRESCO-1182): the same user's own row is a no-op (`owned`), but a row of ANOTHER user
 * (the previous person on a shared browser) used to be swallowed as a success too, so the switch
 * said "on", the new user was never notified and the previous user's reminders kept arriving at
 * that device. RLS lets a user read only their own rows, so asking for this endpoint tells the two
 * apart; `taken` is for the caller to resolve with a fresh browser subscription.
 */
export async function savePushSubscription(
  client: SupabaseClient<Database>,
  { subscription, userId }: { subscription: PushSubscriptionKeys, userId?: string },
): Promise<SavePushSubscriptionResult> {
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user }, error: userError } = await client.auth.getUser();

    if (userError || !user) {
      throw new PushSubscriptionError('No hay una sesión autenticada para activar los avisos.');
    }

    resolvedUserId = user.id;
  }

  const { error } = await client
    .from('push_subscriptions')
    .insert({
      user_id: resolvedUserId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    });

  if (!error) {
    return 'saved';
  }
  if (error.code !== '23505') {
    throw new PushSubscriptionError(`No se pudo activar los avisos: ${error.message}`);
  }

  const mine = await hasPushSubscription(client, { endpoint: subscription.endpoint, userId: resolvedUserId });
  return mine ? 'owned' : 'taken';
}

/**
 * Whether THIS user has a stored row for `endpoint` (RLS shows a user only their own rows, so the `user_id`
 * filter is belt and braces). The `/profile` switch reads it so it reflects the database, not just the browser.
 */
export async function hasPushSubscription(
  client: SupabaseClient<Database>,
  { endpoint, userId }: { endpoint: string, userId: string },
): Promise<boolean> {
  const { data, error } = await client
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new PushSubscriptionError(`No se pudo comprobar los avisos: ${error.message}`);
  }
  return data !== null;
}

/**
 * Removes a browser push subscription by its unique `endpoint` — never a
 * blanket `user_id` delete, since one user can have several
 * browsers/devices subscribed and opting out should only drop THIS
 * browser's row. RLS (`push_subscriptions_delete_own`) still enforces that
 * the row belongs to the caller.
 */
export async function deletePushSubscription(
  client: SupabaseClient<Database>,
  endpoint: string,
): Promise<void> {
  const { error } = await client
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    throw new PushSubscriptionError(`No se pudieron desactivar los avisos: ${error.message}`);
  }
}
