import { subscribeToPush as subscribeToPushFor, unsubscribeFromPush as unsubscribeFromPushFor } from '@/lib/push/web-push-client';
import { createClient } from '@/lib/supabase/client';

/** ADR-0041: web-push subscription storage, bound to the signed-in browser session. */

export async function subscribeToPush({ vapidPublicKey }: { vapidPublicKey: string }) {
  return subscribeToPushFor({ client: createClient(), vapidPublicKey });
}

export async function unsubscribeFromPush() {
  return unsubscribeFromPushFor(createClient());
}
