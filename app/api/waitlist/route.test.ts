import * as realSentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

/**
 * FRESCO-1008 — `POST /api/waitlist`: validation, the per-address limit, the double opt-in email
 * (sent only for a signup that needs one), the same answer for new / pending / confirmed addresses,
 * and a failed email surfacing as an error instead of a false "check your inbox".
 *
 * FRESCO-1103 (audit 8 A8-ABUSE-02/03, A8-OPS-02): the Turnstile gate, the failed email reaching
 * Sentry, and the signup of a failed email being removed so the retry sends again.
 */

let rpcResults: Record<string, { data: unknown, error: unknown }> = {};
let rpcCalls: Array<{ name: string, args: Record<string, unknown> }> = [];
let sendError: Error | null = null;
const sent: Array<{ to: string, confirmUrl: string, removeUrl: string }> = [];
const captureException = mock((_error: unknown, _hint?: unknown) => 'id');
const captureMessage = mock((_message: string, _hint?: unknown) => 'id');
const realFetch = globalThis.fetch;
let cloudflare: (() => Response | Promise<Response>) | null = null;
const cloudflareCalls: URLSearchParams[] = [];

const serviceClient = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    return rpcResults[name] ?? { data: null, error: null };
  },
};

void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => serviceClient }));
void mock.module('@sentry/nextjs', () => ({ ...realSentry, captureException, captureMessage }));
// `mock.module` leaks into the files that run after this one: keep every export of the module (FRESCO-1024).
void mock.module('@/lib/email/resend', () => ({
  sendSubscriptionConfirmationEmail: async () => {},
  sendWaitlistConfirmationEmail: async (params: { to: string, confirmUrl: string, removeUrl: string }) => {
    if (sendError) { throw sendError; }
    sent.push(params);
  },
}));

const { POST } = await import('./route');

function req(body: unknown) {
  return new NextRequest('https://test.fresco.local/api/waitlist', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const GOOD = { email: 'ana@example.com', consent: true };

beforeEach(() => {
  rpcResults = { check_ip_rate_limit: { data: true, error: null }, request_waitlist_signup: { data: 'send', error: null } };
  rpcCalls = [];
  sendError = null;
  sent.length = 0;
  captureException.mockClear();
  captureMessage.mockClear();
  cloudflareCalls.length = 0;
  cloudflare = () => new Response(JSON.stringify({ success: true }));
  // The signup tests below run on a build with no captcha; the Turnstile block turns it on.
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('challenges.cloudflare.com')) {
      cloudflareCalls.push(init?.body as URLSearchParams);
      return cloudflare!();
    }
    return realFetch(url, init);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe('POST /api/waitlist', () => {
  test('400 for a body that is not JSON, and for a bad email or missing consent; nothing is written', async () => {
    expect((await POST(req('{nope'))).status).toBe(400);
    expect((await POST(req({ email: 'ana', consent: true }))).status).toBe(400);
    expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  test('a new signup registers, mails a link with the token to that address and answers pending', async () => {
    const res = await POST(req(GOOD));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pending: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ana@example.com');
    expect(sent[0].confirmUrl).toMatch(/^https:\/\/test\.fresco\.local\/lista-de-espera\?token=[\w-]{43}&accion=confirmar$/);
    expect(sent[0].removeUrl).toMatch(/&accion=baja$/);
  });

  test('the database receives only the hash of the token that was mailed', async () => {
    await POST(req(GOOD));

    const call = rpcCalls.find(c => c.name === 'request_waitlist_signup')!;
    const token = new URL(sent[0].confirmUrl).searchParams.get('token')!;
    expect(JSON.stringify(call.args)).not.toContain(token);
    expect(call.args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test.each(['throttled', 'confirmed'])('%s answers the same 200 and sends nothing', async (outcome) => {
    rpcResults.request_waitlist_signup = { data: outcome, error: null };
    const res = await POST(req(GOOD));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pending: true });
    expect(sent).toHaveLength(0);
  });

  test('429 over the per-address limit, before anything is registered', async () => {
    rpcResults.check_ip_rate_limit = { data: false, error: null };
    const res = await POST(req(GOOD));

    expect(res.status).toBe(429);
    expect(rpcCalls.map(c => c.name)).toEqual(['check_ip_rate_limit']);
  });

  test('500 when the limit check or the registration fails', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      rpcResults.check_ip_rate_limit = { data: null, error: { code: 'x' } };
      expect((await POST(req(GOOD))).status).toBe(500);

      rpcResults.check_ip_rate_limit = { data: true, error: null };
      rpcResults.request_waitlist_signup = { data: null, error: { code: 'x' } };
      expect((await POST(req(GOOD))).status).toBe(500);
    }
    finally {
      console.error = original;
    }
  });

  test('a failed email is an error, not a false "check your inbox"', async () => {
    sendError = new Error('smtp down');
    const original = console.error;
    console.error = () => {};
    try {
      expect((await POST(req(GOOD))).status).toBe(502);
    }
    finally {
      console.error = original;
    }
  });
});

describe('POST /api/waitlist — a mail that fails to send (FRESCO-1103)', () => {
  const quietly = async <T>(run: () => Promise<T>): Promise<T> => {
    const original = console.error;
    console.error = () => {};
    try { return await run(); }
    finally { console.error = original; }
  };

  test('the failure reaches Sentry with the route tag', async () => {
    sendError = new Error('smtp down');

    await quietly(async () => POST(req(GOOD)));

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(sendError);
    expect(captureException.mock.calls[0][1]).toEqual({ tags: { route: 'waitlist' } });
  });

  test('the signup it registered is removed by the hash of the token that was not delivered', async () => {
    sendError = new Error('smtp down');
    rpcResults.remove_waitlist_signup = { data: true, error: null };

    await quietly(async () => POST(req(GOOD)));

    const registered = rpcCalls.find(c => c.name === 'request_waitlist_signup')!;
    const removed = rpcCalls.filter(c => c.name === 'remove_waitlist_signup');
    expect(removed).toHaveLength(1);
    expect(removed[0].args.p_token_hash).toBe(registered.args.p_token_hash);
  });

  test('so the retry is not throttled: the next request sends again', async () => {
    sendError = new Error('smtp down');
    expect((await quietly(async () => POST(req(GOOD)))).status).toBe(502);

    sendError = null;
    const retry = await POST(req(GOOD));

    expect(retry.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  test('if the removal itself fails the answer is still 502 and that failure is reported too', async () => {
    sendError = new Error('smtp down');
    rpcResults.remove_waitlist_signup = { data: null, error: { code: 'x' } };

    const res = await quietly(async () => POST(req(GOOD)));

    expect(res.status).toBe(502);
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  test('nothing is removed when the mail went out', async () => {
    await POST(req(GOOD));

    expect(rpcCalls.map(c => c.name)).not.toContain('remove_waitlist_signup');
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('POST /api/waitlist — the captcha (FRESCO-1103)', () => {
  const withCaptcha = { ...GOOD, captchaToken: 'tok' };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
  });

  test('400 without a token, and neither the limit nor the registration nor the mail is touched', async () => {
    const res = await POST(req(GOOD));

    expect(res.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  test('400 for an empty or non-string token', async () => {
    expect((await POST(req({ ...GOOD, captchaToken: '' }))).status).toBe(400);
    expect((await POST(req({ ...GOOD, captchaToken: 7 }))).status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  test('400 when Cloudflare rejects the token', async () => {
    cloudflare = () => new Response(JSON.stringify({ 'success': false, 'error-codes': ['timeout-or-duplicate'] }));

    const res = await POST(req(withCaptcha));

    expect(res.status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  test('503 when Cloudflare cannot be reached: refuse, never pass unchecked', async () => {
    cloudflare = () => { throw new Error('offline'); };
    const original = console.error;
    console.error = () => {};
    try {
      const res = await POST(req(withCaptcha));

      expect(res.status).toBe(503);
      expect(sent).toHaveLength(0);
    }
    finally {
      console.error = original;
    }
  });

  test('503 and a Sentry message when the build shows the captcha but the secret is not configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const original = console.error;
    console.error = () => {};
    try {
      const res = await POST(req(withCaptcha));

      expect(res.status).toBe(503);
      expect(cloudflareCalls).toHaveLength(0);
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(sent).toHaveLength(0);
    }
    finally {
      console.error = original;
    }
  });

  test('sends the token, the secret and the caller\'s IP to Cloudflare, then signs up as usual', async () => {
    const res = await POST(req(withCaptcha));

    expect(cloudflareCalls[0].get('response')).toBe('tok');
    expect(cloudflareCalls[0].get('secret')).toBe('secret-key');
    expect(cloudflareCalls[0].get('remoteip')).toBe('203.0.113.7');
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  test('a request that fails the captcha does not spend the address limit', async () => {
    await POST(req(GOOD));

    expect(rpcCalls.map(c => c.name)).not.toContain('check_ip_rate_limit');
  });

  test('a build with no site key needs no token (the captcha is opt-in per build)', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const res = await POST(req(GOOD));

    expect(res.status).toBe(200);
    expect(cloudflareCalls).toHaveLength(0);
  });
});
