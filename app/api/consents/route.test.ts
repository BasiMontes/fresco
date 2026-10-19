import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { LEGAL_TEXTS_VERSION } from '@/lib/legal/consent';

/**
 * FRESCO-794 — `POST /api/consents` records the caller's consents. Tests: the
 * auth gate, body validation, that the VERSION comes from the server and never
 * from the body, that the owner is the verified session's and never the body's,
 * and a database error surfacing as a 500. FRESCO-1007: the write is the
 * `record_consents` function called with the service role, since the table has no
 * INSERT grant for a client role; the grants and the function itself are proven
 * against a real database in `tests/db/user-consents.test.ts`.
 */

interface RpcCall { name: string, args: unknown }

let user: { id: string } | null = { id: 'user_1' };
let rpcError: unknown = null;
let rpcCalls: RpcCall[] = [];

const sessionClient = { auth: { getUser: async () => ({ data: { user } }) } };
const serviceClient = {
  rpc: async (name: string, args: unknown) => {
    rpcCalls.push({ name, args });
    return { error: rpcError };
  },
};

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => sessionClient }));
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => serviceClient }));

const { POST } = await import('./route');

function req(body: unknown) {
  return new NextRequest('https://test.fresco.local/api/consents', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  user = { id: 'user_1' };
  rpcError = null;
  rpcCalls = [];
});

describe('POST /api/consents', () => {
  test('401 without an authenticated session, and writes nothing', async () => {
    user = null;
    const res = await POST(req({ kinds: ['terms'] }));

    expect(res.status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  test('400 when the body is not JSON', async () => {
    expect((await POST(req('{not json'))).status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  test.each([
    ['no kinds', {}],
    ['an unknown kind', { kinds: ['marketing'] }],
    ['empty kinds', { kinds: [] }],
  ])('400 for %s', async (_label, body) => {
    expect((await POST(req(body))).status).toBe(400);
    expect(rpcCalls).toHaveLength(0);
  });

  test('records the kinds through record_consents for the session user, with the server version', async () => {
    const res = await POST(req({ kinds: ['terms', 'privacy', 'age_14'] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recorded: ['terms', 'privacy', 'age_14'], version: LEGAL_TEXTS_VERSION });
    expect(rpcCalls).toEqual([{ name: 'record_consents', args: { p_user_id: 'user_1', p_kinds: ['terms', 'privacy', 'age_14'], p_version: LEGAL_TEXTS_VERSION } }]);
  });

  test('ignores a version or user_id sent in the body: the server owns both', async () => {
    await POST(req({ kinds: ['terms'], version: 'forged', user_id: 'someone_else' }));

    expect(rpcCalls[0].args).toEqual({ p_user_id: 'user_1', p_kinds: ['terms'], p_version: LEGAL_TEXTS_VERSION });
  });

  test('500 when the database rejects the write', async () => {
    rpcError = { code: 'P0001', message: 'record_consents: user reached the limit of 100 consent rows' };
    const spy = mock(() => {});
    const original = console.error;
    console.error = spy;
    try {
      expect((await POST(req({ kinds: ['terms'] }))).status).toBe(500);
    }
    finally {
      console.error = original;
    }
  });
});
