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

function req() {
  return new NextRequest('https://test.fresco.local/api/stripe/checkout', { method: 'POST' });
}

beforeEach(() => {
  process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
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
});
