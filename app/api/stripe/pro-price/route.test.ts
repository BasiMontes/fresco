import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-794 — `GET /api/stripe/pro-price` feeds the pre-contract summary. Tests:
 * the auth and guest gates, that the figures come from Stripe's Price, that
 * "tax included" is claimed only when Stripe says `inclusive`, and that the trial
 * is offered only to a user who never started a checkout.
 */

interface FakePrice { unit_amount: number | null, currency: string, recurring: { interval: string, interval_count: number } | null, tax_behavior: string }

const MONTHLY: FakePrice = { unit_amount: 499, currency: 'eur', recurring: { interval: 'month', interval_count: 1 }, tax_behavior: 'unspecified' };

const pricesRetrieve = mock(async (_id: string): Promise<FakePrice> => MONTHLY);
let supa = fakeSupabase();

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));
void mock.module('@/lib/stripe', () => ({ ...realStripe, stripe: { prices: { retrieve: pricesRetrieve } } }));

const { GET } = await import('./route');

function ctx(user: { id: string, is_anonymous?: boolean } | null, profileRow: unknown = { stripe_customer_id: null, stripe_subscription_id: null }) {
  return fakeSupabase(
    { user_profiles: { rows: profileRow } },
    { getUser: async () => ({ data: { user } }) },
  );
}

function req(query = '') {
  return new NextRequest(`http://localhost/api/stripe/pro-price${query}`);
}

async function body() {
  return await (await GET(req())).json() as { taxIncluded: boolean, trialDays: number | null };
}

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
  process.env.STRIPE_PRICE_ID_PRO_ANUAL = 'price_pro_year';
  pricesRetrieve.mockClear();
  pricesRetrieve.mockResolvedValue(MONTHLY);
  supa = ctx({ id: 'user_1' });
});

describe('GET /api/stripe/pro-price', () => {
  test('401 without a session, and Stripe is not called', async () => {
    supa = ctx(null);
    expect((await GET(req())).status).toBe(401);
    expect(pricesRetrieve).not.toHaveBeenCalled();
  });

  test('403 for a guest', async () => {
    supa = ctx({ id: 'guest', is_anonymous: true });
    expect((await GET(req())).status).toBe(403);
    expect(pricesRetrieve).not.toHaveBeenCalled();
  });

  test('500 when the price id is not configured', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    expect((await GET(req())).status).toBe(500);
  });

  test('FRESCO-844: ?interval=year reads the annual price, anything else the monthly one', async () => {
    pricesRetrieve.mockResolvedValue({ unit_amount: 4499, currency: 'eur', recurring: { interval: 'year', interval_count: 1 }, tax_behavior: 'unspecified' });
    const res = await GET(req('?interval=year'));
    expect(pricesRetrieve).toHaveBeenLastCalledWith('price_pro_year');
    expect(await res.json()).toMatchObject({ amount: 44.99, interval: 'year' });

    await GET(req('?interval=week'));
    expect(pricesRetrieve).toHaveBeenLastCalledWith('price_pro_month');
  });

  test('FRESCO-844: 500 for ?interval=year when the annual price is not configured', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    expect((await GET(req('?interval=year'))).status).toBe(500);
    expect(pricesRetrieve).not.toHaveBeenCalled();
  });

  test('reads the amount, currency and period from Stripe, in euros not cents', async () => {
    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(pricesRetrieve).toHaveBeenCalledWith('price_pro_month');
    expect(await res.json()).toMatchObject({ amount: 4.99, currency: 'eur', interval: 'month', intervalCount: 1 });
  });

  test('does not claim the tax is included unless Stripe says inclusive', async () => {
    for (const behavior of ['unspecified', 'exclusive']) {
      pricesRetrieve.mockResolvedValueOnce({ ...MONTHLY, tax_behavior: behavior });
      expect((await body()).taxIncluded).toBe(false);
    }

    pricesRetrieve.mockResolvedValueOnce({ ...MONTHLY, tax_behavior: 'inclusive' });
    expect((await body()).taxIncluded).toBe(true);
  });

  test('offers the 7-day trial to a user who never started a checkout', async () => {
    expect((await body()).trialDays).toBe(7);
  });

  test('no trial for a user who already has a Stripe customer on file', async () => {
    supa = ctx({ id: 'user_1' }, { stripe_customer_id: 'cus_1', stripe_subscription_id: null });
    expect((await body()).trialDays).toBeNull();
  });

  test('500 for a price that is not a fixed recurring amount', async () => {
    pricesRetrieve.mockResolvedValueOnce({ ...MONTHLY, unit_amount: null, recurring: null });
    expect((await GET(req())).status).toBe(500);
  });

  test('500 when Stripe fails', async () => {
    pricesRetrieve.mockRejectedValueOnce(new Error('stripe down'));
    const original = console.error;
    console.error = () => {};
    try {
      expect((await GET(req())).status).toBe(500);
    }
    finally {
      console.error = original;
    }
  });
});
