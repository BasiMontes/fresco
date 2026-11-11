import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { deletePushSubscription, hasPushSubscription, savePushSubscription } from '@/lib/api/push-subscriptions';
import { SERVICE_WORKER_URL } from '@/lib/pwa/service-worker';

export class WebPushError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebPushError';
  }
}

/**
 * Feature-detects the Push API. Safari has partial/inconsistent support
 * (no `PushManager` on iOS Safari as of writing) — this gate, not a
 * try/catch around `subscribe()`, is what decides whether the opt-in toggle
 * even renders enabled.
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * VAPID public keys arrive base64url-encoded (RFC 4648 §5) —
 * `pushManager.subscribe()`'s `applicationServerKey` wants a raw
 * `Uint8Array`. Standard conversion (no library needed for one function,
 * this is the same snippet MDN and every push-notification tutorial ships).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers `/sw.js` at the root scope. Idempotent — `register()` resolves
 * with the existing registration if one already matches the script URL, so
 * calling this on every toggle click (not just the first) is safe.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  }
  catch (error) {
    throw new WebPushError(`No se pudo registrar el service worker: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * The active `PushSubscription` for THIS browser, or `null` if there isn't
 * one (never subscribed, or the subscription was cleared). Used on mount to
 * reflect real subscribed state instead of guessing from
 * `Notification.permission` alone — permission can be `'granted'` with no
 * active subscription (e.g. the user opted out via this same toggle).
 *
 * Uses `getRegistration()`, NOT `serviceWorker.ready` — `.ready` only
 * resolves once a service worker reaches the "activated" state, and stays
 * pending FOREVER if no registration exists yet at all (a first-time
 * visitor who has never opted in, i.e. the common case). Caught live: the
 * toggle rendered permanently stuck in its "checking" state until this
 * fixed it.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => undefined);
  if (!registration) {
    return null;
  }
  return registration.pushManager.getSubscription();
}

/**
 * Whether this browser's subscription is stored for the signed-in user (FRESCO-1182). The `/profile` switch
 * used to mirror only the browser, so on a shared browser the second user saw "on" with nothing stored for
 * them. A read error falls back to the browser's own state: it must not flip the switch off by itself.
 */
export async function isCurrentSubscriptionStored(client: SupabaseClient<Database>): Promise<boolean> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    return false;
  }
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return false;
    }
    return await hasPushSubscription(client, { endpoint: subscription.endpoint, userId: user.id });
  }
  catch {
    return true;
  }
}

export interface SubscribeToPushArgs {
  client: SupabaseClient<Database>
  vapidPublicKey: string
}

/**
 * Full opt-in flow: register the SW -> request `Notification` permission ->
 * subscribe via `PushManager` -> persist the subscription to
 * `push_subscriptions`. Throws `WebPushError` at any step the UI should
 * surface — including a permission denial (fail fast, per
 * `references/error-handling.md`); the UI does not retry-prompt on denial,
 * since browsers block a second native permission prompt after one anyway.
 */
export async function subscribeToPush({ client, vapidPublicKey }: SubscribeToPushArgs): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new WebPushError('Este navegador no admite notificaciones push.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new WebPushError('No has dado permiso para recibir notificaciones.');
  }

  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const createSubscription = async () => registration.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast: TS 5.7+'s `lib.dom.d.ts` types `Uint8Array` generically over its
    // backing buffer, while `PushSubscriptionOptionsInit.applicationServerKey`
    // still wants the older `BufferSource` shape — a plain `new Uint8Array()`
    // satisfies `BufferSource` at runtime either way, this is a type-only gap.
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const store = async (candidate: PushSubscription) => {
    const keys = candidate.toJSON().keys;
    if (!keys?.p256dh || !keys.auth) {
      throw new WebPushError('La suscripción del navegador no incluyó las claves esperadas.');
    }
    return savePushSubscription(client, {
      subscription: {
        endpoint: candidate.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });
  };

  let subscription = (await registration.pushManager.getSubscription()) ?? await createSubscription();

  // FRESCO-1182: on a shared browser the endpoint this browser already holds can still be stored for the
  // PREVIOUS user. It is not ours to take over (no UPDATE policy, and a client must not be able to claim
  // another user's row), so drop it and ask the push service for a fresh endpoint that belongs to this user.
  // The previous user's row now points at a dead endpoint, which the weekly sender removes on its first 410.
  if (await store(subscription) === 'taken') {
    await subscription.unsubscribe();
    subscription = await createSubscription();
    if (await store(subscription) === 'taken') {
      throw new WebPushError('No se pudo asociar este navegador a tu cuenta. Inténtalo de nuevo.');
    }
  }

  return subscription;
}

/**
 * Full opt-out flow: delete the `push_subscriptions` row FIRST, then
 * unsubscribe the browser's `PushSubscription`. Order matters — if this
 * were reversed (browser first, DB second) a failure between the two steps
 * would orphan the DB row: `getCurrentPushSubscription()` returns `null`
 * once the browser subscription is gone, so a retry would short-circuit on
 * the guard below and never reach `deletePushSubscription`, leaving a row
 * no UI path can ever remove again. DB-first means the worst partial
 * failure (delete succeeds, `unsubscribe()` throws) just leaves a stale
 * browser subscription with no matching row — harmless (no send target,
 * `23505` no-ops a future re-subscribe) and a retry still finds the
 * browser subscription to finish unsubscribing.
 */
export async function unsubscribeFromPush(client: SupabaseClient<Database>): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    return;
  }

  await deletePushSubscription(client, subscription.endpoint);
  await subscription.unsubscribe();
}
