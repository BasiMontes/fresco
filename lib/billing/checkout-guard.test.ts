import { describe, expect, mock, test } from 'bun:test';
import { checkoutSessionWindow, ensureCheckoutCustomer, hasLiveSubscription } from './checkout-guard';

/** FRESCO-1002 — the pure parts of the double-checkout guard; the route test covers the wiring. */

describe('checkoutSessionWindow', () => {
  const at = (iso: string) => new Date(iso).getTime();

  test('every moment of one minute maps to the same key and the same expiry', () => {
    const early = checkoutSessionWindow({ userId: 'u', interval: 'month', now: at('2026-10-17T10:00:00.000Z') });
    const late = checkoutSessionWindow({ userId: 'u', interval: 'month', now: at('2026-10-17T10:00:59.999Z') });
    expect(late).toEqual(early);
  });

  test('the next minute is a new session', () => {
    const first = checkoutSessionWindow({ userId: 'u', interval: 'month', now: at('2026-10-17T10:00:59.999Z') });
    const next = checkoutSessionWindow({ userId: 'u', interval: 'month', now: at('2026-10-17T10:01:00.000Z') });
    expect(next.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  test('the expiry is always at least 30 minutes after the moment of the POST, the minimum Stripe accepts', () => {
    for (const second of [0, 1, 30, 59]) {
      const now = at('2026-10-17T10:00:00.000Z') + second * 1000;
      const { expiresAt } = checkoutSessionWindow({ userId: 'u', interval: 'month', now });
      expect(expiresAt - now / 1000).toBeGreaterThanOrEqual(30 * 60);
    }
  });

  test('user and plan are part of the key', () => {
    const base = checkoutSessionWindow({ userId: 'u1', interval: 'month', now: 0 }).idempotencyKey;
    expect(checkoutSessionWindow({ userId: 'u2', interval: 'month', now: 0 }).idempotencyKey).not.toBe(base);
    expect(checkoutSessionWindow({ userId: 'u1', interval: 'year', now: 0 }).idempotencyKey).not.toBe(base);
  });
});

describe('hasLiveSubscription', () => {
  const stripeWith = (statuses: string[]) => ({
    subscriptions: { list: mock(async () => ({ data: statuses.map((status, i) => ({ id: `sub_${i}`, status })) })) },
  }) as unknown as Parameters<typeof hasLiveSubscription>[0];

  test.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])('%s is live', async (status) => {
    expect(await hasLiveSubscription(stripeWith([status]), 'cus_1')).toBe(true);
  });

  test.each(['canceled', 'incomplete_expired'])('%s is not', async (status) => {
    expect(await hasLiveSubscription(stripeWith([status]), 'cus_1')).toBe(false);
  });

  test('no subscriptions at all is not live', async () => {
    expect(await hasLiveSubscription(stripeWith([]), 'cus_1')).toBe(false);
  });
});

describe('ensureCheckoutCustomer', () => {
  test('a quote in the user id cannot break out of the search query', async () => {
    const search = mock(async (_p: { query: string }) => ({ data: [{ id: 'cus_1' }] }));
    const stripe = { customers: { search, create: mock() } } as unknown as Parameters<typeof ensureCheckoutCustomer>[0];

    await ensureCheckoutCustomer(stripe, { userId: 'a\' OR metadata[\'x\']:\'y', email: undefined, storedCustomerId: null });

    expect(search.mock.calls[0][0].query).toBe('metadata[\'supabase_user_id\']:\'a\\\' OR metadata[\\\'x\\\']:\\\'y\'');
  });
});
