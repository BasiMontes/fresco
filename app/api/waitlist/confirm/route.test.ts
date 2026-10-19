import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { hashWaitlistToken, newWaitlistToken } from '@/lib/legal/waitlist';

/** FRESCO-1008 — `POST /api/waitlist/confirm`: only a well-formed token reaches the database, which is asked with its hash. */

let rpcResults: Record<string, { data: unknown, error: unknown }> = {};
let rpcCalls: Array<{ name: string, args: Record<string, unknown> }> = [];

void mock.module('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
  }),
}));

const { POST } = await import('./route');

const req = (body: unknown) => new NextRequest('https://test.fresco.local/api/waitlist/confirm', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  rpcResults = { check_ip_rate_limit: { data: true, error: null }, confirm_waitlist_signup: { data: true, error: null }, remove_waitlist_signup: { data: true, error: null } };
  rpcCalls = [];
});

describe('POST /api/waitlist/confirm', () => {
  test('400 for a malformed token or an unknown action, with no database call', async () => {
    expect((await POST(req({ token: 'nope', action: 'confirm' }))).status).toBe(400);
    expect((await POST(req({ token: newWaitlistToken(), action: 'delete-all' }))).status).toBe(400);
    expect((await POST(req(null))).status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  test('confirm asks confirm_waitlist_signup with the hash of the token', async () => {
    const token = newWaitlistToken();
    const res = await POST(req({ token, action: 'confirm' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ done: 'confirm' });
    expect(rpcCalls.at(-1)).toEqual({ name: 'confirm_waitlist_signup', args: { p_token_hash: hashWaitlistToken(token) } });
  });

  test('remove asks remove_waitlist_signup', async () => {
    const res = await POST(req({ token: newWaitlistToken(), action: 'remove' }));

    expect(res.status).toBe(200);
    expect(rpcCalls.at(-1)?.name).toBe('remove_waitlist_signup');
  });

  test('404 when no signup has that token', async () => {
    rpcResults.confirm_waitlist_signup = { data: false, error: null };

    expect((await POST(req({ token: newWaitlistToken(), action: 'confirm' }))).status).toBe(404);
  });

  test('429 over the limit, and nothing is changed', async () => {
    rpcResults.check_ip_rate_limit = { data: false, error: null };

    expect((await POST(req({ token: newWaitlistToken(), action: 'confirm' }))).status).toBe(429);
    expect(rpcCalls.map(c => c.name)).toEqual(['check_ip_rate_limit']);
  });
});
