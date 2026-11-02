import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as subscriptionsApi from '@/lib/api/push-subscriptions';
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  urlBase64ToUint8Array,
  WebPushError,
} from './web-push-client';

describe('urlBase64ToUint8Array', () => {
  test('decodes a base64url VAPID-shaped key into raw bytes', () => {
    // "hello" base64url-encoded, no padding — matches how VAPID public keys
    // arrive (base64url, RFC 4648 §5, padding stripped).
    const result = urlBase64ToUint8Array('aGVsbG8');

    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  test('handles the URL-safe -/_ characters that base64url substitutes for +//', () => {
    // Encodes bytes that map to `+`/`/` in standard base64 (`>?` -> `Pj8=`),
    // which base64url spells `Pj8` with `-`/`_` swapped in where relevant —
    // this input exercises the `.replace(/-/g, '+').replace(/_/g, '/')` step.
    const result = urlBase64ToUint8Array('Pj8-Pw');

    expect(result.length).toBeGreaterThan(0);
  });
});

// FRESCO-1076 — the browser opt-in / opt-out flow. The Push API does not exist
// in the test DOM, so the browser surface is stubbed and the property pinned is
// the ORDER and the failure messages: nothing is saved without a permission and
// keys, and the row is deleted before the browser subscription is.

const client = {} as SupabaseClient<Database>;

interface FakeSubscription {
  endpoint: string
  toJSON: () => { keys?: { p256dh?: string, auth?: string } }
  unsubscribe: ReturnType<typeof mock>
}

function subscription(keys: { p256dh?: string, auth?: string } | null = { p256dh: 'p256', auth: 'auth' }): FakeSubscription {
  return { endpoint: 'https://push.example/abc', toJSON: () => (keys ? { keys } : {}), unsubscribe: mock(async () => true) };
}

const original = {
  serviceWorker: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'),
  pushManager: Object.getOwnPropertyDescriptor(window, 'PushManager'),
  notification: Object.getOwnPropertyDescriptor(globalThis, 'Notification'),
};

const events: string[] = [];
let existing: FakeSubscription | null;
let created: FakeSubscription;
let permission: NotificationPermission;
let register: ReturnType<typeof mock>;
let getRegistration: ReturnType<typeof mock>;
let saveSpy: ReturnType<typeof spyOn<typeof subscriptionsApi, 'savePushSubscription'>>;
let deleteSpy: ReturnType<typeof spyOn<typeof subscriptionsApi, 'deletePushSubscription'>>;

function installBrowser() {
  const registration = {
    pushManager: {
      getSubscription: mock(async () => existing),
      subscribe: mock(async () => { events.push('subscribe'); return created; }),
    },
  };
  register = mock(async () => registration);
  getRegistration = mock(async () => registration);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, getRegistration, ready: Promise.resolve(registration) },
  });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { requestPermission: mock(async () => permission) },
  });
}

function restore(target: object, key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) { Object.defineProperty(target, key, descriptor); }
  else { Reflect.deleteProperty(target, key); }
}

beforeEach(() => {
  events.length = 0;
  existing = null;
  created = subscription();
  permission = 'granted';
  installBrowser();
  saveSpy = spyOn(subscriptionsApi, 'savePushSubscription').mockImplementation(async () => { events.push('save'); });
  deleteSpy = spyOn(subscriptionsApi, 'deletePushSubscription').mockImplementation(async () => { events.push('delete'); });
});

afterEach(() => {
  saveSpy.mockRestore();
  deleteSpy.mockRestore();
  restore(navigator, 'serviceWorker', original.serviceWorker);
  restore(window, 'PushManager', original.pushManager);
  restore(globalThis, 'Notification', original.notification);
});

describe('isPushSupported', () => {
  test('is true when the browser has a service worker and a PushManager', () => {
    expect(isPushSupported()).toBe(true);
  });

  test('is false when there is no PushManager (iOS Safari)', () => {
    Reflect.deleteProperty(window, 'PushManager');
    expect(isPushSupported()).toBe(false);
  });
});

describe('getCurrentPushSubscription', () => {
  test('is null without asking the browser when push is not supported', async () => {
    Reflect.deleteProperty(window, 'PushManager');
    expect(await getCurrentPushSubscription()).toBeNull();
    expect(getRegistration).not.toHaveBeenCalled();
  });

  test('is null for a first-time visitor with no registration', async () => {
    getRegistration.mockResolvedValue(undefined);
    expect(await getCurrentPushSubscription()).toBeNull();
  });

  test('is null when reading the registration fails', async () => {
    getRegistration.mockRejectedValue(new Error('denied'));
    expect(await getCurrentPushSubscription()).toBeNull();
  });

  test('returns the subscription this browser already holds', async () => {
    existing = subscription();
    expect(await getCurrentPushSubscription()).toBe(existing);
  });
});

describe('subscribeToPush', () => {
  const args = { client, vapidPublicKey: 'aGVsbG8' };

  test('refuses with a clear message when push is not supported', async () => {
    Reflect.deleteProperty(window, 'PushManager');
    await expect(subscribeToPush(args)).rejects.toThrow('Este navegador no admite notificaciones push.');
  });

  test('a denied permission stops before anything is registered or saved', async () => {
    permission = 'denied';
    await expect(subscribeToPush(args)).rejects.toThrow(WebPushError);
    expect(register).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test('a service worker that cannot register is reported with its reason', async () => {
    register.mockRejectedValue(new Error('script 404'));
    await expect(subscribeToPush(args)).rejects.toThrow('No se pudo registrar el service worker: script 404');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test('a non-Error rejection from register is still reported', async () => {
    register.mockRejectedValue('boom');
    await expect(subscribeToPush(args)).rejects.toThrow('No se pudo registrar el service worker: boom');
  });

  test('subscribes with the VAPID key and saves the endpoint and both keys', async () => {
    const result = await subscribeToPush(args);
    expect(result).toBe(created);
    expect(saveSpy).toHaveBeenCalledWith(client, {
      subscription: { endpoint: 'https://push.example/abc', p256dh: 'p256', auth: 'auth' },
    });
    expect(events).toEqual(['subscribe', 'save']);
  });

  test('reuses a subscription the browser already has instead of creating another', async () => {
    existing = subscription();
    const result = await subscribeToPush(args);
    expect(result).toBe(existing);
    expect(events).toEqual(['save']);
  });

  test('a subscription without keys is never saved', async () => {
    created = subscription({ p256dh: 'p256' });
    await expect(subscribeToPush(args)).rejects.toThrow('La suscripción del navegador no incluyó las claves esperadas.');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test('a subscription with no keys object at all is never saved', async () => {
    created = subscription(null);
    await expect(subscribeToPush(args)).rejects.toThrow(WebPushError);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

describe('unsubscribeFromPush', () => {
  test('does nothing when the browser holds no subscription', async () => {
    await unsubscribeFromPush(client);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  test('deletes the stored row first and only then unsubscribes the browser', async () => {
    existing = subscription();
    existing.unsubscribe.mockImplementation(async () => { events.push('unsubscribe'); return true; });
    await unsubscribeFromPush(client);
    expect(deleteSpy).toHaveBeenCalledWith(client, 'https://push.example/abc');
    expect(events).toEqual(['delete', 'unsubscribe']);
  });

  test('when deleting the row fails the browser subscription is kept, so a retry can finish', async () => {
    existing = subscription();
    deleteSpy.mockRejectedValue(new Error('db down'));
    await expect(unsubscribeFromPush(client)).rejects.toThrow('db down');
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });
});
