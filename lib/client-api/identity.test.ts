import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realLazy from '@/lib/supabase/client-lazy';
import { getPlanTierForAnalyticsLazy, getSessionLazy, readProfileNombre, syncAnalyticsConsent, watchAuthState } from './identity';

/**
 * FRESCO-919 (ADR-0044) — `syncAnalyticsConsent` reads the stored decision and
 * writes only when it differs, and skips a user with no profile row yet.
 */

let stored: Record<string, unknown> | null = null;
const updates: unknown[] = [];
let session: unknown = null;
let clientFails = false;
let unsubscribed = 0;
let subscribedHandler: unknown = null;

const client = {
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (handler: unknown) => {
      subscribedHandler = handler;
      return { data: { subscription: { unsubscribe: () => { unsubscribed += 1; } } } };
    },
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored }) }) }),
    update: (values: unknown) => {
      updates.push(values);
      return { eq: async () => ({ error: null }) };
    },
  }),
};

void mock.module('@/lib/supabase/client-lazy', () => ({
  loadSupabaseClient: async () => ({
    createClient: () => {
      if (clientFails) { throw new Error('client failed to load'); }
      return client;
    },
  }),
}));

// `mock.module` is process-wide in bun: put the real module back so later test files see it.
afterAll(() => {
  void mock.module('@/lib/supabase/client-lazy', () => realLazy);
});

beforeEach(() => {
  stored = null;
  updates.length = 0;
  session = null;
  clientFails = false;
  unsubscribed = 0;
  subscribedHandler = null;
});

describe('syncAnalyticsConsent', () => {
  test('writes the decision when the stored one differs', async () => {
    stored = { analytics_consent: null };

    await syncAnalyticsConsent({ userId: 'user-1', accepted: false });

    expect(updates).toEqual([{ analytics_consent: false }]);
  });

  test('writes nothing when the stored decision already matches', async () => {
    stored = { analytics_consent: true };

    await syncAnalyticsConsent({ userId: 'user-1', accepted: true });

    expect(updates).toEqual([]);
  });

  test('skips a user with no profile row (onboarding carries the decision)', async () => {
    stored = null;

    await syncAnalyticsConsent({ userId: 'user-1', accepted: true });

    expect(updates).toEqual([]);
  });
});

describe('getSessionLazy', () => {
  test('returns the current session, or null when there is none', async () => {
    expect(await getSessionLazy()).toBeNull();

    session = { access_token: 'tok' };
    expect(await getSessionLazy()).toEqual({ access_token: 'tok' });
  });
});

describe('watchAuthState', () => {
  test('subscribes with the caller\'s handler and returns the unsubscribe', async () => {
    const onChange = () => {};
    const stop = await watchAuthState({ onChange, signal: new AbortController().signal });

    expect(subscribedHandler).toBe(onChange);
    expect(unsubscribed).toBe(0);
    stop();
    expect(unsubscribed).toBe(1);
  });

  test('opens no subscription when the caller already unmounted (signal aborted)', async () => {
    const controller = new AbortController();
    controller.abort();

    const stop = await watchAuthState({ onChange: () => {}, signal: controller.signal });
    stop();

    expect(subscribedHandler).toBeNull();
    expect(unsubscribed).toBe(0);
  });
});

describe('readProfileNombre', () => {
  test('returns the stored display name', async () => {
    stored = { nombre: 'Ana' };
    expect(await readProfileNombre('user-1')).toBe('Ana');
  });

  test('returns null when there is no profile row or no name: the nav just shows no greeting', async () => {
    expect(await readProfileNombre('user-1')).toBeNull();

    stored = { nombre: null };
    expect(await readProfileNombre('user-1')).toBeNull();
  });
});

describe('getPlanTierForAnalyticsLazy', () => {
  test('returns the stored plan', async () => {
    stored = { plan: 'pro' };
    expect(await getPlanTierForAnalyticsLazy('user-1')).toBe('pro');
  });

  test('falls back to free when the client cannot load: analytics must never break the layout', async () => {
    clientFails = true;
    stored = { plan: 'pro' };
    expect(await getPlanTierForAnalyticsLazy('user-1')).toBe('free');
  });
});
