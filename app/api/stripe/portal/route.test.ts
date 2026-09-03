import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-410 — `POST /api/stripe/portal` opens a Stripe Billing Portal
 * session for the caller's existing customer. Tests: auth gate, the
 * "must still be Pro with a customer id on file" guard (a stale
 * `stripe_customer_id` after a downgrade must not open a live portal), and
 * the happy path.
 */

const portalCreate = mock(async (_p: unknown): Promise<{ url: string }> => ({ url: 'https://billing.stripe/x' }));
let supa = fakeSupabase();

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));
void mock.module('@/lib/stripe', () => ({ ...realStripe, stripe: { billingPortal: { sessions: { create: portalCreate } } } }));

const { POST } = await import('./route');

function req() {
  return new NextRequest('https://test.fresco.local/api/stripe/portal', { method: 'POST' });
}

function ctx(user: { id: string } | null, profileRow: unknown) {
  return fakeSupabase(
    { user_profiles: { rows: profileRow } },
    { getUser: async () => ({ data: { user } }) },
  );
}

beforeEach(() => {
  portalCreate.mockClear();
  portalCreate.mockResolvedValue({ url: 'https://billing.stripe/x' });
  supa = ctx({ id: 'user_1' }, { plan: 'pro', stripe_customer_id: 'cus_1' });
});

describe('POST /api/stripe/portal', () => {
  test('401 without an authenticated session', async () => {
    supa = ctx(null, null);
    expect((await POST(req())).status).toBe(401);
  });

  test('404 when the caller is no longer Pro', async () => {
    supa = ctx({ id: 'user_1' }, { plan: 'free', stripe_customer_id: 'cus_1' });
    expect((await POST(req())).status).toBe(404);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  test('404 when Pro but no stripe_customer_id on file', async () => {
    supa = ctx({ id: 'user_1' }, { plan: 'pro', stripe_customer_id: null });
    expect((await POST(req())).status).toBe(404);
  });

  test('returns the hosted portal URL for a Pro customer', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://billing.stripe/x' });
    expect((portalCreate.mock.calls[0][0] as { customer: string }).customer).toBe('cus_1');
  });

  test('500 when the profile read errors', async () => {
    supa = fakeSupabase(
      { user_profiles: { selectError: new Error('rls') } },
      { getUser: async () => ({ data: { user: { id: 'user_1' } } }) },
    );
    expect((await POST(req())).status).toBe(500);
  });
});
