import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';

/**
 * FRESCO-1008 — `POST /api/waitlist`: validation, the per-address limit, the double opt-in email
 * (sent only for a signup that needs one), the same answer for new / pending / confirmed addresses,
 * and a failed email surfacing as an error instead of a false "check your inbox".
 */

let rpcResults: Record<string, { data: unknown, error: unknown }> = {};
let rpcCalls: Array<{ name: string, args: Record<string, unknown> }> = [];
let sendError: Error | null = null;
const sent: Array<{ to: string, confirmUrl: string, removeUrl: string }> = [];

const serviceClient = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    return rpcResults[name] ?? { data: null, error: null };
  },
};

void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => serviceClient }));
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
    headers: { 'x-forwarded-for': '203.0.113.7' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const GOOD = { email: 'ana@example.com', consent: true };

beforeEach(() => {
  rpcResults = { check_ip_rate_limit: { data: true, error: null }, request_waitlist_signup: { data: 'send', error: null } };
  rpcCalls = [];
  sendError = null;
  sent.length = 0;
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
