import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { LEGAL_TEXTS_VERSION } from '@/lib/legal/consent';

/**
 * FRESCO-794 — `POST /api/consents` records the caller's consents. Tests: the
 * auth gate, body validation, that the VERSION comes from the server and never
 * from the body, that the owner is never sent (the session owns the row), and a
 * database error surfacing as a 500. The RLS and column-grant side is proven
 * against a real database in `tests/db/user-consents.test.ts`.
 */

interface Upsert { table: string, rows: unknown, options: unknown }

let user: { id: string } | null = { id: 'user_1' };
let upsertError: unknown = null;
let upserts: Upsert[] = [];

const client = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: (table: string) => ({
    upsert: async (rows: unknown, options: unknown) => {
      upserts.push({ table, rows, options });
      return { error: upsertError };
    },
  }),
};

void mock.module('@/lib/supabase/server', () => ({ createClient: async () => client }));

const { POST } = await import('./route');

function req(body: unknown) {
  return new NextRequest('https://test.fresco.local/api/consents', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  user = { id: 'user_1' };
  upsertError = null;
  upserts = [];
});

describe('POST /api/consents', () => {
  test('401 without an authenticated session, and writes nothing', async () => {
    user = null;
    const res = await POST(req({ kinds: ['terms'] }));

    expect(res.status).toBe(401);
    expect(upserts).toHaveLength(0);
  });

  test('400 when the body is not JSON', async () => {
    expect((await POST(req('{not json'))).status).toBe(400);
    expect(upserts).toHaveLength(0);
  });

  test.each([
    ['no kinds', {}],
    ['an unknown kind', { kinds: ['marketing'] }],
    ['empty kinds', { kinds: [] }],
  ])('400 for %s', async (_label, body) => {
    expect((await POST(req(body))).status).toBe(400);
    expect(upserts).toHaveLength(0);
  });

  test('records each kind with the server version, ignoring duplicates', async () => {
    const res = await POST(req({ kinds: ['terms', 'privacy', 'age_14'] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recorded: ['terms', 'privacy', 'age_14'], version: LEGAL_TEXTS_VERSION });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe('user_consents');
    expect(upserts[0].rows).toEqual([
      { kind: 'terms', version: LEGAL_TEXTS_VERSION },
      { kind: 'privacy', version: LEGAL_TEXTS_VERSION },
      { kind: 'age_14', version: LEGAL_TEXTS_VERSION },
    ]);
    expect(upserts[0].options).toEqual({ onConflict: 'user_id,kind,version', ignoreDuplicates: true });
  });

  test('ignores a version or user_id sent in the body: the server owns both', async () => {
    await POST(req({ kinds: ['terms'], version: 'forged', user_id: 'someone_else' }));

    expect(upserts[0].rows).toEqual([{ kind: 'terms', version: LEGAL_TEXTS_VERSION }]);
  });

  test('500 when the database rejects the write', async () => {
    upsertError = { code: '42501', message: 'permission denied' };
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
