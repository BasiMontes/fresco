import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { CONSENT_PENDING_KEY, flushPendingConsents, pendingConsentKinds, postConsents, REGISTRATION_CONSENTS } from './consent-client';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: Array<{ url: string, body: unknown }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body as string) : null });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

function fakeClient(metadata: unknown) {
  const updateUser = mock(async (_attrs: unknown) => ({ data: {}, error: null }));
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { user_metadata: metadata } } }),
      updateUser,
    },
  } as unknown as SupabaseClient;
  return { client, updateUser };
}

describe('REGISTRATION_CONSENTS', () => {
  test('is the age confirmation plus the Terms and the Privacy Policy', () => {
    expect(REGISTRATION_CONSENTS).toEqual(['age_14', 'terms', 'privacy']);
  });
});

describe('postConsents', () => {
  test('posts the kinds as JSON and reports success', async () => {
    const calls = stubFetch(async () => new Response(null, { status: 200 }));

    expect(await postConsents(['terms'])).toBe(true);
    expect(calls).toEqual([{ url: '/api/consents', body: { kinds: ['terms'] } }]);
  });

  test('false on a non-OK response', async () => {
    stubFetch(async () => new Response(null, { status: 500 }));
    expect(await postConsents(['terms'])).toBe(false);
  });

  test('false, not a throw, when the network fails', async () => {
    stubFetch(async () => {
      throw new Error('offline');
    });
    expect(await postConsents(['terms'])).toBe(false);
  });
});

describe('pendingConsentKinds', () => {
  test('reads the parked kinds from the metadata', () => {
    expect(pendingConsentKinds({ [CONSENT_PENDING_KEY]: ['age_14', 'terms'] })).toEqual(['age_14', 'terms']);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['no key', {}],
    ['cleared (null)', { [CONSENT_PENDING_KEY]: null }],
    ['not an array', { [CONSENT_PENDING_KEY]: 'terms' }],
    ['an unknown kind', { [CONSENT_PENDING_KEY]: ['terms', 'marketing'] }],
  ])('empty for %s', (_label, metadata) => {
    expect(pendingConsentKinds(metadata)).toEqual([]);
  });
});

describe('flushPendingConsents', () => {
  test('records the parked consents, then clears them from the metadata', async () => {
    const calls = stubFetch(async () => new Response(null, { status: 200 }));
    const { client, updateUser } = fakeClient({ [CONSENT_PENDING_KEY]: ['age_14', 'terms', 'privacy'] });

    await flushPendingConsents(client);

    expect(calls).toEqual([{ url: '/api/consents', body: { kinds: ['age_14', 'terms', 'privacy'] } }]);
    expect(updateUser).toHaveBeenCalledWith({ data: { [CONSENT_PENDING_KEY]: null } });
  });

  test('keeps them parked when the write fails, so the next visit retries', async () => {
    stubFetch(async () => new Response(null, { status: 500 }));
    const { client, updateUser } = fakeClient({ [CONSENT_PENDING_KEY]: ['terms'] });

    await flushPendingConsents(client);

    expect(updateUser).not.toHaveBeenCalled();
  });

  test('does nothing, and calls nothing, when there is nothing parked', async () => {
    const calls = stubFetch(async () => new Response(null, { status: 200 }));
    const { client, updateUser } = fakeClient({});

    await flushPendingConsents(client);

    expect(calls).toHaveLength(0);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
