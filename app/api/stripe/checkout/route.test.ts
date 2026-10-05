import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-410 — `POST /api/stripe/checkout` creates a Stripe Checkout Session
 * and hands back its hosted URL. It never writes subscription state (that is
 * the webhook, ADR-0007). Tests: the auth gate, missing-price config, and
 * the happy path.
 */

const sessionsCreate = mock(async (_p: unknown): Promise<{ id: string, url: string | null }> => ({ id: 'cs_1', url: 'https://checkout.stripe/x' }));
let supa = fakeSupabase({}, { getUser: async () => ({ data: { user: { id: 'user_1' } } }) });

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));
void mock.module('@/lib/stripe', () => ({ ...realStripe, stripe: { checkout: { sessions: { create: sessionsCreate } } } }));

const { POST } = await import('./route');

function req(body?: unknown) {
  return new NextRequest('https://test.fresco.local/api/stripe/checkout', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
  process.env.STRIPE_PRICE_ID_PRO_ANUAL = 'price_pro_year';
  sessionsCreate.mockClear();
  sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe/x' });
  supa = fakeSupabase({}, { getUser: async () => ({ data: { user: { id: 'user_1' } } }) });
});

describe('POST /api/stripe/checkout', () => {
  test('401 without an authenticated session', async () => {
    supa = fakeSupabase({}, { getUser: async () => ({ data: { user: null } }) });
    expect((await POST(req())).status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test('500 when STRIPE_PRICE_ID_PRO_MONTH is not configured', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTH;
    expect((await POST(req())).status).toBe(500);
  });

  test('FRESCO-844: no body or an unknown interval is the monthly price, {interval: year} is the annual one', async () => {
    await POST(req());
    await POST(req({ interval: 'week' }));
    await POST(req({ interval: 'year' }));

    const prices = sessionsCreate.mock.calls.map(c => (c[0] as { line_items: { price: string }[] }).line_items[0].price);
    expect(prices).toEqual(['price_pro_month', 'price_pro_month', 'price_pro_year']);
  });

  test('FRESCO-844: 400 for the annual plan when its price is not configured, Stripe is not called', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO_ANUAL;
    expect((await POST(req({ interval: 'year' }))).status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  test('FRESCO-845: the hosted page is in Spanish with the Fresco line under the pay button', async () => {
    await POST(req());

    const params = sessionsCreate.mock.calls[0][0] as { locale: string, custom_text: { submit: { message: string } } };
    expect(params.locale).toBe('es');
    expect(params.custom_text.submit.message).toContain('Fresco');
    expect(params.custom_text.submit.message.length).toBeLessThanOrEqual(1200);
  });

  test('returns the hosted Checkout URL and passes the user id as client_reference_id', async () => {
    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe/x' });
    expect((sessionsCreate.mock.calls[0][0] as { client_reference_id: string }).client_reference_id).toBe('user_1');
  });

  test('500 when Stripe returns a session without a url', async () => {
    sessionsCreate.mockResolvedValue({ id: 'cs_1', url: null });
    expect((await POST(req())).status).toBe(500);
  });

  test('500 when Stripe throws', async () => {
    sessionsCreate.mockRejectedValue(new Error('stripe down'));
    expect((await POST(req())).status).toBe(500);
  });

  describe('FRESCO-778 — one free trial per account (audit-6 A6-S3)', () => {
    const signedIn = { id: 'user_1', is_anonymous: false };
    const authAs = (user: Record<string, unknown>) => ({ getUser: async () => ({ data: { user } }) });
    const withProfile = (profile: Record<string, unknown>, user: Record<string, unknown> = signedIn) =>
      fakeSupabase({ user_profiles: { rows: profile } }, authAs(user));
    const lastSessionParams = () => sessionsCreate.mock.calls.at(-1)![0] as Record<string, unknown>;

    test('a first-time user gets the 7-day card-less trial and no customer is pinned', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: null, stripe_subscription_id: null });

      expect((await POST(req())).status).toBe(200);
      const params = lastSessionParams();
      expect(params.subscription_data).toEqual({
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      });
      expect(params.payment_method_collection).toBe('if_required');
      expect(params).not.toHaveProperty('customer');
    });

    test('an anonymous guest cannot start a checkout', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: null, stripe_subscription_id: null }, { id: 'guest_1', is_anonymous: true });

      expect((await POST(req())).status).toBe(403);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('a user who is already Pro gets a 409 and no second session', async () => {
      supa = withProfile({ plan: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });

      expect((await POST(req())).status).toBe(409);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('a returning customer reuses their Stripe customer and gets NO trial (card required)', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });

      expect((await POST(req())).status).toBe(200);
      const params = lastSessionParams();
      expect(params.customer).toBe('cus_1');
      expect(params).not.toHaveProperty('subscription_data');
      expect(params.payment_method_collection).toBe('always');
    });

    test('a stored subscription id alone is enough to mark the trial as used', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: null, stripe_subscription_id: 'sub_1' });

      await POST(req());
      expect(lastSessionParams()).not.toHaveProperty('subscription_data');
    });

    test('a stored customer id alone is enough to mark the trial as used', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: 'cus_1', stripe_subscription_id: null });

      await POST(req());
      expect(lastSessionParams()).not.toHaveProperty('subscription_data');
      expect(lastSessionParams().customer).toBe('cus_1');
    });

    test('429 when the per-user rate limit is exhausted, before any Stripe call', async () => {
      supa = fakeSupabase({ user_profiles: { rows: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null } } }, authAs(signedIn), async () => ({ data: false, error: null }));

      expect((await POST(req())).status).toBe(429);
      expect(sessionsCreate).not.toHaveBeenCalled();
      expect(supa.rpcCalls[0]).toEqual(['check_and_increment_rate_limit', { p_user_id: 'user_1', p_endpoint: 'stripe-checkout', p_limit: 10, p_window_seconds: 3600 }]);
    });

    test('500 (fail closed) when the rate-limit check itself errors', async () => {
      supa = fakeSupabase({ user_profiles: { rows: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null } } }, authAs(signedIn), async () => ({ data: null, error: new Error('rpc down') }));

      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('500 when the profile cannot be read, rather than granting a trial blindly', async () => {
      supa = fakeSupabase({ user_profiles: { selectError: new Error('db down') } }, authAs(signedIn));

      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });
  });
});
