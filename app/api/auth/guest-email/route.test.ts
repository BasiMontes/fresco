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
const realFetch = globalThis.fetch;
let cloudflare: (() => Response | Promise<Response>) | null = null;
const cloudflareCalls: URLSearchParams[] = [];

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => supa.client }));

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
