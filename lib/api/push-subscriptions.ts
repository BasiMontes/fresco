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
 * Persists a browser push subscription for the CURRENTLY authenticated user
 * (FRESCO-241 PR2). `push_subscriptions` has no UPDATE RLS policy by design
 * (PR1 migration: "a subscription is replaced (delete + insert) rather than
 * edited") — so a plain `insert` is used, and a `23505` unique-violation on
 * `endpoint` (this browser already has a row) is swallowed as a no-op
 * instead of surfacing as an error.
 */
export async function savePushSubscription(
  client: SupabaseClient<Database>,
  subscription: PushSubscriptionKeys,
  userId?: string,
): Promise<void> {
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

  if (error) {
    if (error.code === '23505') {
      return;
    }
    throw new PushSubscriptionError(`No se pudo activar los avisos: ${error.message}`);
  }
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
