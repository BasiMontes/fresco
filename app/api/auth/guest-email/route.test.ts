import * as realSentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-1006 (audit 7b A7-ABUSE-02) — `POST /api/auth/guest-email` is step 1 of the guest
 * conversion. Without a Turnstile token it answers 400, the fourth call in an hour answers 429, and
 * a check that cannot be completed refuses instead of passing.
 */

const updateUser = mock(async (_attributes: unknown): Promise<{ error: { code?: string, message: string, status?: number } | null }> => ({ error: null }));
let supa = fakeSupabase();
let service = fakeSupabase();
let serviceThrows = false;
const realFetch = globalThis.fetch;
let cloudflare: (() => Response | Promise<Response>) | null = null;
const cloudflareCalls: URLSearchParams[] = [];

const captureMessage = mock((_message: string, _hint?: unknown) => 'id');
// `mock.module` leaks into the files that run after this one: keep every export of the module (FRESCO-1024).
void mock.module('@sentry/nextjs', () => ({ ...realSentry, captureMessage }));
void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));
void mock.module('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    if (serviceThrows) { throw new Error('SUPABASE_SERVICE_ROLE_KEY is required'); }
    return service.client;
  },
}));

const { POST } = await import('./route');

const GUEST = { id: 'guest_1', is_anonymous: true };

function ctx(user: Record<string, unknown> | null = GUEST, rpc?: Parameters<typeof fakeSupabase>[2]) {
  return fakeSupabase({}, { getUser: async () => ({ data: { user } }), updateUser }, rpc);
}

function req(body: unknown) {
  return new NextRequest('https://test.fresco.local/api/auth/guest-email', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } });
}

const valid = { email: 'ana@example.com', captchaToken: 'tok' };
const code = async (res: Response) => ((await res.json()) as { error?: { code?: string } }).error?.code;

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';
  process.env.TURNSTILE_SECRET_KEY = 'secret-key';
  updateUser.mockClear();
  updateUser.mockResolvedValue({ error: null });
  cloudflareCalls.length = 0;
  cloudflare = () => new Response(JSON.stringify({ success: true }));
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      cloudflareCalls.push(init?.body as URLSearchParams);
      return cloudflare!();
    }
    return realFetch(url, init);
  }) as unknown as typeof fetch;
  supa = ctx();
  service = fakeSupabase();
  serviceThrows = false;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe('POST /api/auth/guest-email — who may call it', () => {
  test('401 without a session', async () => {
    supa = ctx(null);

    expect((await POST(req(valid))).status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('403 for a registered user: only a guest converts', async () => {
    supa = ctx({ id: 'user_1', is_anonymous: false });

    const res = await POST(req(valid));

    expect(res.status).toBe(403);
    expect(await code(res)).toBe('not_a_guest');
    expect(updateUser).not.toHaveBeenCalled();
  });

  test.each([
    ['not JSON', 'nope'],
    ['no email', { captchaToken: 'tok' }],
    ['a number', { email: 5, captchaToken: 'tok' }],
    ['no @', { email: 'ana.example.com', captchaToken: 'tok' }],
    ['spaces', { email: 'ana @example.com', captchaToken: 'tok' }],
    ['too long', { email: `${'a'.repeat(250)}@x.es`, captchaToken: 'tok' }],
  ])('400 validation_failed for an email that is %s, before any captcha or limit work', async (_label, body) => {
    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect(await code(res)).toBe('validation_failed');
    expect(cloudflareCalls).toHaveLength(0);
    expect(supa.rpcCalls).toHaveLength(0);
  });
});

describe('POST /api/auth/guest-email — the captcha (FRESCO-1006)', () => {
  test('400 without a token, and neither the limit nor Auth is touched', async () => {
    const res = await POST(req({ email: 'ana@example.com' }));

    expect(res.status).toBe(400);
    expect(await code(res)).toBe('captcha_failed');
    expect(supa.rpcCalls).toHaveLength(0);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('400 for an empty or non-string token', async () => {
    expect((await POST(req({ email: 'ana@example.com', captchaToken: '' }))).status).toBe(400);
    expect((await POST(req({ email: 'ana@example.com', captchaToken: 7 }))).status).toBe(400);
  });

  test('400 when Cloudflare rejects the token', async () => {
    cloudflare = () => new Response(JSON.stringify({ 'success': false, 'error-codes': ['timeout-or-duplicate'] }));

    const res = await POST(req(valid));

    expect(res.status).toBe(400);
    expect(await code(res)).toBe('captcha_failed');
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('503 when Cloudflare cannot be reached: refuse, never pass unchecked', async () => {
    cloudflare = () => { throw new Error('offline'); };

    const res = await POST(req(valid));

    expect(res.status).toBe(503);
    expect(await code(res)).toBe('captcha_unavailable');
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('503 when the build shows the captcha but the secret is not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const res = await POST(req(valid));

    expect(res.status).toBe(503);
    expect(cloudflareCalls).toHaveLength(0);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('503, not a pass, when the secret is only whitespace (a clipboard paste gone wrong)', async () => {
    process.env.TURNSTILE_SECRET_KEY = ' \n ';

    const res = await POST(req(valid));

    expect(res.status).toBe(503);
    expect(cloudflareCalls).toHaveLength(0);
  });

  test('503 when Cloudflare rejects the SECRET: our configuration is not the visitor\'s fault', async () => {
    cloudflare = () => new Response(JSON.stringify({ 'success': false, 'error-codes': ['invalid-input-secret'] }));

    const res = await POST(req(valid));

    expect(res.status).toBe(503);
    expect(await code(res)).toBe('captcha_unavailable');
  });

  test('sends the token, the secret and the caller\'s IP to Cloudflare', async () => {
    await POST(req(valid));

    expect(cloudflareCalls[0].get('response')).toBe('tok');
    expect(cloudflareCalls[0].get('secret')).toBe('secret-key');
    expect(cloudflareCalls[0].get('remoteip')).toBe('9.9.9.9');
  });

  test('a build with no site key needs no token (the captcha is opt-in per build), but is still limited', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const res = await POST(req({ email: 'ana@example.com' }));

    expect(res.status).toBe(200);
    expect(cloudflareCalls).toHaveLength(0);
    expect(supa.rpcCalls).toHaveLength(1);
  });
});

describe('POST /api/auth/guest-email — the limit and the update (FRESCO-1006)', () => {
  test('asks for the guest-email-change endpoint, 3 an hour, for the caller', async () => {
    await POST(req(valid));

    expect(supa.rpcCalls[0]).toEqual(['check_and_increment_rate_limit', { p_user_id: 'guest_1', p_endpoint: 'guest-email-change', p_limit: 3, p_window_seconds: 3600 }]);
  });

  test('the fourth call in an hour is a 429 and Auth is not asked to send a fourth mail', async () => {
    let used = 0;
    supa = ctx(GUEST, async () => ({ data: ++used <= 3, error: null }));

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) { statuses.push((await POST(req(valid))).status); }

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(updateUser).toHaveBeenCalledTimes(3);
  });

  test('429 carries the code the client already translates', async () => {
    supa = ctx(GUEST, async () => ({ data: false, error: null }));

    expect(await code(await POST(req(valid)))).toBe('over_email_send_rate_limit');
  });

  test('fails closed: a limiter that errors is a 500, not a pass', async () => {
    supa = ctx(GUEST, async () => ({ data: null, error: new Error('rpc down') }));

    expect((await POST(req(valid))).status).toBe(500);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('links the typed email, trimmed, and answers ok', async () => {
    const res = await POST(req({ email: '  ana@example.com ', captchaToken: 'tok' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ email: 'ana@example.com' });
  });

  test('passes the Auth error through with its status and code, so email_exists keeps working', async () => {
    updateUser.mockResolvedValueOnce({ error: { code: 'email_exists', message: 'A user with this email address has already been registered', status: 422 } });

    const res = await POST(req(valid));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: { code: 'email_exists', message: 'A user with this email address has already been registered' } });
  });
});

describe('POST /api/auth/guest-email — the grant the database demands (FRESCO-1085)', () => {
  test('asks the database for a one-shot grant for the guest BEFORE Auth is asked to write the email', async () => {
    const order: string[] = [];
    service = fakeSupabase({}, undefined, async (name) => { order.push(name); return { data: true, error: null }; });
    updateUser.mockImplementationOnce(async () => { order.push('updateUser'); return { error: null }; });

    expect((await POST(req(valid))).status).toBe(200);

    expect(order).toEqual(['check_ip_rate_limit', 'grant_guest_email_change', 'updateUser']);
    expect(service.rpcCalls[1]).toEqual(['grant_guest_email_change', { p_user_id: 'guest_1' }]);
  });

  test('limits per IP, keyed on the first forwarded address, 10 an hour', async () => {
    await POST(req(valid));

    const [name, args] = service.rpcCalls[0] as [string, { p_endpoint: string, p_limit: number, p_key_hash: string }];
    expect(name).toBe('check_ip_rate_limit');
    expect(args.p_endpoint).toBe('guest-email-change');
    expect(args.p_limit).toBe(10);
    expect(args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('429 when the IP is over its limit: no grant, no Auth call', async () => {
    service = fakeSupabase({}, undefined, async () => ({ data: false, error: null }));

    const res = await POST(req(valid));

    expect(res.status).toBe(429);
    expect(await code(res)).toBe('over_email_send_rate_limit');
    expect(service.rpcCalls.map(([name]) => name)).toEqual(['check_ip_rate_limit']);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('fails closed: an IP limiter that errors is a 500', async () => {
    service = fakeSupabase({}, undefined, async () => ({ data: null, error: new Error('rpc down') }));

    expect((await POST(req(valid))).status).toBe(500);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('fails closed: a grant that cannot be written is a 500, Auth is not asked', async () => {
    service = fakeSupabase({}, undefined, async name => (name === 'grant_guest_email_change' ? { data: null, error: new Error('boom') } : { data: true, error: null }));

    expect((await POST(req(valid))).status).toBe(500);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('fails closed: no service-role key means a 500, never an ungranted update', async () => {
    serviceThrows = true;

    expect((await POST(req(valid))).status).toBe(500);
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('a request that fails the captcha or the guest limit never reaches the grant', async () => {
    supa = ctx(GUEST, async () => ({ data: false, error: null }));
    expect((await POST(req(valid))).status).toBe(429);

    supa = ctx();
    expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(400);

    expect(service.rpcCalls).toHaveLength(0);
  });
});

/**
 * FRESCO-1170 (integral review F3): a production build that lost the Turnstile site key used to skip the captcha in
 * silence, leaving only the per-address limits in front of an email sent to any address. In production it refuses
 * now; everywhere else a build with no key keeps working.
 */
describe('POST /api/auth/guest-email — a production build with no site key (FRESCO-1170)', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.VERCEL_ENV = 'production';
    captureMessage.mockClear();
  });
  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  test('503 captcha_unavailable, Sentry hears of it, and no code is mailed nor any limit spent', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const res = await POST(req({ email: 'ana@example.com' }));

      expect(res.status).toBe(503);
      expect(await code(res)).toBe('captcha_unavailable');
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(String(captureMessage.mock.calls[0][0])).toContain('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
      expect(updateUser).not.toHaveBeenCalled();
      expect(supa.rpcCalls).toHaveLength(0);
      expect(cloudflareCalls).toHaveLength(0);
    }
    finally {
      console.error = original;
    }
  });

  test('a token does not help: without the site key the check cannot be trusted either', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const res = await POST(req(valid));

      expect(res.status).toBe(503);
      expect(updateUser).not.toHaveBeenCalled();
    }
    finally {
      console.error = original;
    }
  });

  test.each(['preview', 'development'])('the same build on %s still works without a key (the captcha stays opt-in there)', async (vercelEnv) => {
    process.env.VERCEL_ENV = vercelEnv;

    const res = await POST(req({ email: 'ana@example.com' }));

    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  test('production WITH the key goes through the normal captcha path', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';

    const res = await POST(req(valid));

    expect(res.status).toBe(200);
    expect(cloudflareCalls).toHaveLength(1);
  });
});
