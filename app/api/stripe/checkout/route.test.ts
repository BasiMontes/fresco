import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { WITHDRAWAL_WAIVER_WINDOW_MS } from '@/lib/legal/consent';
import * as realStripe from '@/lib/stripe';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-410 — `POST /api/stripe/checkout` creates a Stripe Checkout Session
 * and hands back its hosted URL. It never writes subscription state (that is
 * the webhook, ADR-0007). Tests: the auth gate, missing-price config, and
 * the happy path.
 */

/** FRESCO-1003: a signed-in user with a finished profile and a recorded withdrawal waiver, the starting point of every case. */
const GIVEN_WAIVER = { user_consents: { rows: [{ id: 'consent_1' }] } };
const FREE_PROFILE = { user_profiles: { rows: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null } } };

const sessionsCreate = mock(async (_p: unknown, _o?: unknown): Promise<{ id: string, url: string | null }> => ({ id: 'cs_1', url: 'https://checkout.stripe/x' }));
/** FRESCO-1002: the Stripe lookups that run before a session is created, and the cleanup after. */
const customersSearch = mock(async (_p: unknown): Promise<{ data: { id: string }[] }> => ({ data: [] }));
const customersCreate = mock(async (_p: unknown, _o?: unknown): Promise<{ id: string }> => ({ id: 'cus_new' }));
const subscriptionsList = mock(async (_p: unknown): Promise<{ data: { id: string, status: string }[] }> => ({ data: [] }));
const sessionsList = mock(async (_p: unknown): Promise<{ data: { id: string }[] }> => ({ data: [] }));
const sessionsExpire = mock(async (_id: string): Promise<{ id: string }> => ({ id: 'expired' }));
let supa = fakeSupabase({ ...FREE_PROFILE, ...GIVEN_WAIVER }, { getUser: async () => ({ data: { user: { id: 'user_1' } } }) });
/** FRESCO-1001: the Stripe mode the fake `billing_mode` row says the shared database serves, or an error to read it. */
let databaseLivemode: boolean | Error = false;

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));
void mock.module('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => (databaseLivemode instanceof Error
          ? { data: null, error: databaseLivemode }
          : { data: { stripe_livemode: databaseLivemode }, error: null }),
      }),
    }),
  }),
}));
void mock.module('@/lib/stripe', () => ({ ...realStripe, stripe: {
  customers: { search: customersSearch, create: customersCreate },
  subscriptions: { list: subscriptionsList },
  checkout: { sessions: { create: sessionsCreate, list: sessionsList, expire: sessionsExpire } },
} }));

const { POST } = await import('./route');

function req(body?: unknown) {
  return new NextRequest('https://test.fresco.local/api/stripe/checkout', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
  databaseLivemode = false;
  process.env.STRIPE_PRICE_ID_PRO_MONTH = 'price_pro_month';
  process.env.STRIPE_PRICE_ID_PRO_ANUAL = 'price_pro_year';
  for (const m of [sessionsCreate, customersSearch, customersCreate, subscriptionsList, sessionsList, sessionsExpire]) {
    m.mockClear();
  }
  sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe/x' });
  customersSearch.mockResolvedValue({ data: [] });
  customersCreate.mockResolvedValue({ id: 'cus_new' });
  subscriptionsList.mockResolvedValue({ data: [] });
  sessionsList.mockResolvedValue({ data: [] });
  supa = fakeSupabase({ ...FREE_PROFILE, ...GIVEN_WAIVER }, { getUser: async () => ({ data: { user: { id: 'user_1' } } }) });
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

  test('FRESCO-845: the hosted page carries the Fresco brand (name, colours, pill button, icon) on every session', async () => {
    await POST(req());
    await POST(req({ interval: 'year' }));

    for (const [params] of sessionsCreate.mock.calls) {
      const { branding_settings: branding } = params as { branding_settings: { display_name: string, button_color: string, background_color: string, border_style: string, icon: { type: string, url: string } } };
      expect(branding.display_name).toBe('Fresco');
      expect(branding.button_color).toMatch(/^#[0-9A-F]{6}$/);
      expect(branding.background_color).toMatch(/^#[0-9A-F]{6}$/);
      expect(branding.border_style).toBe('pill');
      // Stripe fetches the icon when the session is created, so it must be a public https URL.
      expect(branding.icon.type).toBe('url');
      expect(branding.icon.url).toMatch(/^https:\/\/.+\.png$/);
    }
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
      fakeSupabase({ user_profiles: { rows: profile }, ...GIVEN_WAIVER }, authAs(user));
    const lastSessionParams = () => sessionsCreate.mock.calls.at(-1)![0] as Record<string, unknown>;

    test('a first-time user gets the 7-day card-less trial on a freshly created customer', async () => {
      supa = withProfile({ plan: 'free', stripe_customer_id: null, stripe_subscription_id: null });

      expect((await POST(req())).status).toBe(200);
      const params = lastSessionParams();
      expect(params.subscription_data).toEqual({
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      });
      expect(params.payment_method_collection).toBe('if_required');
      expect(params.customer).toBe('cus_new');
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
      supa = fakeSupabase({ user_profiles: { rows: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null } }, ...GIVEN_WAIVER }, authAs(signedIn), async () => ({ data: false, error: null }));

      expect((await POST(req())).status).toBe(429);
      expect(sessionsCreate).not.toHaveBeenCalled();
      expect(supa.rpcCalls[0]).toEqual(['check_and_increment_rate_limit', { p_user_id: 'user_1', p_endpoint: 'stripe-checkout', p_limit: 10, p_window_seconds: 3600 }]);
    });

    test('500 (fail closed) when the rate-limit check itself errors', async () => {
      supa = fakeSupabase({ user_profiles: { rows: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null } }, ...GIVEN_WAIVER }, authAs(signedIn), async () => ({ data: null, error: new Error('rpc down') }));

      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('500 when the profile cannot be read, rather than granting a trial blindly', async () => {
      supa = fakeSupabase({ user_profiles: { selectError: new Error('db down') } }, authAs(signedIn));

      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });
  });
  describe('FRESCO-1001 — Stripe mode guard (audit 7b: A7-PAY-01, ADR-0061)', () => {
    const signedIn = { id: 'user_1', is_anonymous: false };
    const withProfile = (profile: Record<string, unknown>) =>
      fakeSupabase({ user_profiles: { rows: profile }, ...GIVEN_WAIVER }, { getUser: async () => ({ data: { user: signedIn } }) });
    const lastSessionParams = () => sessionsCreate.mock.calls.at(-1)![0] as Record<string, unknown>;

    test('fresco-pre: a test-mode deploy refuses to open a checkout once the DATABASE is live (503, nothing created)', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
      databaseLivemode = true;

      const res = await POST(req());

      expect(res.status).toBe(503);
      expect(sessionsCreate).not.toHaveBeenCalled();
      expect(supa.rpcCalls).toEqual([]);
    });

    test('the inverse: a live-mode deploy refuses while the database still serves test mode', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
      databaseLivemode = false;

      expect((await POST(req())).status).toBe(503);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('a live deploy on a live database opens the checkout', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
      databaseLivemode = true;
      supa = withProfile({ plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, stripe_livemode: null });

      expect((await POST(req())).status).toBe(200);
    });

    test('fails closed: an unreadable billing_mode, or a key with no known mode, is a 500 and creates nothing', async () => {
      databaseLivemode = new Error('permission denied');
      expect((await POST(req())).status).toBe(500);

      databaseLivemode = false;
      process.env.STRIPE_SECRET_KEY = 'not_a_key';
      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('a stored Stripe customer of the OTHER mode is not reused (it does not exist in this mode), and no trial is given', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
      databaseLivemode = true;
      supa = withProfile({ plan: 'free', stripe_customer_id: 'cus_test_1', stripe_subscription_id: 'sub_test_1', stripe_livemode: false });

      expect((await POST(req())).status).toBe(200);
      const params = lastSessionParams();
      expect(params.customer).toBe('cus_new');
      expect(params).not.toHaveProperty('subscription_data');
      expect(params.payment_method_collection).toBe('always');
    });

    test('a stored customer of the same mode is still reused', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_unit';
      databaseLivemode = true;
      supa = withProfile({ plan: 'free', stripe_customer_id: 'cus_live_1', stripe_subscription_id: 'sub_live_1', stripe_livemode: true });

      await POST(req());
      expect(lastSessionParams().customer).toBe('cus_live_1');
    });
  });

  describe('FRESCO-1002 — no second subscription from a second checkout (audit 7b: A7-PAY-02)', () => {
    const signedIn = { id: 'user_1', is_anonymous: false, email: 'a@b.test' };
    const withProfile = (profile: Record<string, unknown>) =>
      fakeSupabase({ user_profiles: { rows: profile }, ...GIVEN_WAIVER }, { getUser: async () => ({ data: { user: signedIn } }) });
    const free = { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, stripe_livemode: null };
    const sessionOptions = () => sessionsCreate.mock.calls.at(-1)![1] as { idempotencyKey: string };

    test('409 and no session when the customer already has a live subscription, even though the profile still says free', async () => {
      supa = withProfile({ ...free, stripe_customer_id: 'cus_1', stripe_livemode: false });
      subscriptionsList.mockResolvedValue({ data: [{ id: 'sub_1', status: 'trialing' }] });

      expect((await POST(req())).status).toBe(409);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('an ended subscription does not block a new checkout', async () => {
      supa = withProfile({ ...free, stripe_customer_id: 'cus_1', stripe_livemode: false });
      subscriptionsList.mockResolvedValue({ data: [{ id: 'sub_1', status: 'canceled' }, { id: 'sub_2', status: 'incomplete_expired' }] });

      expect((await POST(req())).status).toBe(200);
    });

    test('a user with no customer gets one, found by metadata first and created keyed on the user otherwise', async () => {
      supa = withProfile(free);

      await POST(req());

      expect(customersSearch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(customersSearch.mock.calls[0][0])).toContain('user_1');
      expect(customersCreate.mock.calls[0][0]).toEqual({ metadata: { supabase_user_id: 'user_1' }, email: 'a@b.test' });
      expect(customersCreate.mock.calls[0][1]).toEqual({ idempotencyKey: 'fresco-customer:user_1' });
    });

    test('an existing customer found by metadata is reused, none is created', async () => {
      supa = withProfile(free);
      customersSearch.mockResolvedValue({ data: [{ id: 'cus_found' }] });

      await POST(req());

      expect(customersCreate).not.toHaveBeenCalled();
      expect((sessionsCreate.mock.calls[0][0] as { customer: string }).customer).toBe('cus_found');
    });

    test('a stored customer needs no lookup at all', async () => {
      supa = withProfile({ ...free, stripe_customer_id: 'cus_1', stripe_livemode: false });

      await POST(req());

      expect(customersSearch).not.toHaveBeenCalled();
      expect(customersCreate).not.toHaveBeenCalled();
    });

    test('two POSTs of the same minute send the same idempotency key and the same parameters, so Stripe returns one session', async () => {
      supa = withProfile(free);

      await Promise.all([POST(req()), POST(req())]);

      const [[firstParams, firstOptions], [secondParams, secondOptions]] = sessionsCreate.mock.calls as [[unknown, { idempotencyKey: string }], [unknown, { idempotencyKey: string }]];
      expect(firstOptions.idempotencyKey).toBe(secondOptions.idempotencyKey);
      expect(firstParams).toEqual(secondParams);
    });

    test('the key differs per plan, so the monthly and the annual checkout are not the same session', async () => {
      supa = withProfile(free);

      await POST(req());
      const monthly = sessionOptions().idempotencyKey;
      await POST(req({ interval: 'year' }));

      expect(sessionOptions().idempotencyKey).not.toBe(monthly);
    });

    test('the session expires within the window Stripe accepts (30 minutes to 24 hours)', async () => {
      supa = withProfile(free);
      const before = Math.floor(Date.now() / 1000);

      await POST(req());

      const { expires_at: expiresAt } = sessionsCreate.mock.calls[0][0] as { expires_at: number };
      expect(expiresAt - before).toBeGreaterThanOrEqual(30 * 60);
      expect(expiresAt - before).toBeLessThanOrEqual(35 * 60);
    });

    test('creating a session expires the customer\'s OTHER open sessions and keeps the new one', async () => {
      supa = withProfile(free);
      sessionsList.mockResolvedValue({ data: [{ id: 'cs_old' }, { id: 'cs_1' }] });

      await POST(req());

      expect(sessionsExpire.mock.calls).toEqual([['cs_old']]);
    });

    test('500 and no session when Stripe cannot say whether a subscription is live (fail closed)', async () => {
      supa = withProfile({ ...free, stripe_customer_id: 'cus_1', stripe_livemode: false });
      subscriptionsList.mockRejectedValue(new Error('stripe 503'));

      expect((await POST(req())).status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });
  });

  describe('FRESCO-1003 — the server asks for what the UI used to guarantee (audit 7b A7-PAY-07, A7-PAY-10)', () => {
    const signedIn = { id: 'user_1', is_anonymous: false };
    const authAs = { getUser: async () => ({ data: { user: signedIn } }) };

    test('409 without a profile row, and Stripe is not touched', async () => {
      supa = fakeSupabase({ user_profiles: { rows: null }, ...GIVEN_WAIVER }, authAs);

      const res = await POST(req());

      expect(res.status).toBe(409);
      expect(customersSearch).not.toHaveBeenCalled();
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('400 without a recorded withdrawal waiver, and Stripe is not touched', async () => {
      supa = fakeSupabase({ ...FREE_PROFILE, user_consents: { rows: null } }, authAs);

      const res = await POST(req());

      expect(res.status).toBe(400);
      expect((await res.json() as { error: string }).error).toContain('desistimiento');
      expect(customersSearch).not.toHaveBeenCalled();
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('500, not a pass, when the consent registry cannot be read', async () => {
      supa = fakeSupabase({ ...FREE_PROFILE, user_consents: { selectError: new Error('db down') } }, authAs);

      const res = await POST(req());

      expect(res.status).toBe(500);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    test('a profile and a recorded waiver reach Stripe', async () => {
      supa = fakeSupabase({ ...FREE_PROFILE, ...GIVEN_WAIVER }, authAs);

      expect((await POST(req())).status).toBe(200);
      expect(sessionsCreate).toHaveBeenCalledTimes(1);
    });
  });

  // FRESCO-1021: the right of withdrawal belongs to each contract, so the waiver of an earlier
  // subscription must not let a later one through. The route asks the registry for a row accepted
  // in the last WITHDRAWAL_WAIVER_WINDOW_MS; the registry (the database) applies the filter.
  describe('FRESCO-1021 — the withdrawal waiver has to be recent', () => {
    const authAs = { getUser: async () => ({ data: { user: { id: 'user_1', is_anonymous: false } } }) };

    test('asks the registry for a waiver accepted in the last 30 minutes', async () => {
      const before = Date.now();
      supa = fakeSupabase({ ...FREE_PROFILE, ...GIVEN_WAIVER }, authAs);

      await POST(req());

      const filter = supa.gteFilters.find(f => f.table === 'user_consents');
      expect(filter?.column).toBe('accepted_at');
      const since = new Date(String(filter?.value)).getTime();
      expect(since).toBeGreaterThanOrEqual(before - WITHDRAWAL_WAIVER_WINDOW_MS - 1000);
      expect(since).toBeLessThanOrEqual(Date.now() - WITHDRAWAL_WAIVER_WINDOW_MS + 1000);
    });

    test('400 when the registry has only an older waiver (it answers with no row inside the window)', async () => {
      supa = fakeSupabase({ ...FREE_PROFILE, user_consents: { rows: [] } }, authAs);

      const res = await POST(req());

      expect(res.status).toBe(400);
      expect(sessionsCreate).not.toHaveBeenCalled();
    });
  });
});
