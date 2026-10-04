/**
 * FRESCO-794 (audit-6 A6-P1, ADR-0040) — the consent registry `user_consents`,
 * proven against the real database.
 *
 * The table is the evidence that a user consented (GDPR art. 7.1), so what must
 * hold is who can write it and what they can write:
 *   1. The owner records `(kind, version)`; the database sets `user_id` and
 *      `accepted_at`.
 *   2. A caller can never supply `user_id` (not even their own, not someone
 *      else's) or `accepted_at`: the INSERT grant is column-level.
 *   3. Rows are append-only: no UPDATE, no DELETE, no reading someone else's.
 *   4. Unknown kinds and oversized versions are rejected by CHECK constraints.
 *   5. The same `(user, kind, version)` twice is a unique violation on a plain
 *      insert and a no-op on the `ignore-duplicates` upsert the API route uses.
 *   6. A guest (anonymous session) can record and read their own consent.
 *   7. Deleting the auth user removes the rows.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { anonKey, createDbTestContext, nativeFetch, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';

const code = (res: { body: unknown }) => (res.body as { code?: string }).code;

async function createGuest(): Promise<{ id: string, token: string }> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`[user-consents.test] anonymous sign-in failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token: string, user: { id: string } };
  return { id: json.user.id, token: json.access_token };
}

async function deleteAuthUser(id: string): Promise<void> {
  const key = await serviceRoleKey();
  await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

async function consentsOf(user: { id: string, token: string }) {
  const res = await rest('user_consents', { token: user.token, query: 'select=user_id,kind,version,accepted_at' });
  return res.body as Array<{ user_id: string, kind: string, version: string, accepted_at: string }>;
}

describe.skipIf(!(RUN && reachable))('user_consents (real DB)', () => {
  const ctx = createDbTestContext();
  const guestIds: string[] = [];
  let a: DbTestUser;
  let b: DbTestUser;

  beforeAll(async () => {
    a = await ctx.createUser();
    b = await ctx.createUser();
  });

  afterAll(async () => {
    await Promise.all(guestIds.map(async id => deleteAuthUser(id)));
    await ctx.cleanupAll();
  });

  test('the owner records a consent; the database sets user_id and accepted_at', async () => {
    const res = await rest('user_consents', { method: 'POST', token: a.token, prefer: 'return=minimal', body: { kind: 'terms', version: 'v-owner' } });
    expect(res.status).toBe(201);

    const rows = await consentsOf(a);
    const row = rows.find(r => r.version === 'v-owner');
    expect(row?.user_id).toBe(a.id);
    expect(row?.kind).toBe('terms');
    expect(Date.now() - new Date(row!.accepted_at).getTime()).toBeLessThan(60_000);
  });

  test('a caller cannot supply user_id, not even their own', async () => {
    const own = await rest('user_consents', { method: 'POST', token: a.token, body: { user_id: a.id, kind: 'privacy', version: 'v-own-id' } });
    expect(own.status).toBe(403);
    expect(code(own)).toBe(PERMISSION_DENIED);
  });

  test('a caller cannot record a consent on behalf of another user', async () => {
    const forged = await rest('user_consents', { method: 'POST', token: b.token, body: { user_id: a.id, kind: 'privacy', version: 'v-forged' } });
    expect(forged.status).toBe(403);
    expect(code(forged)).toBe(PERMISSION_DENIED);
    expect((await consentsOf(a)).some(r => r.version === 'v-forged')).toBe(false);
  });

  test('a caller cannot backdate a consent by supplying accepted_at', async () => {
    const res = await rest('user_consents', { method: 'POST', token: a.token, body: { kind: 'age_14', version: 'v-backdated', accepted_at: '2020-01-01T00:00:00Z' } });
    expect(res.status).toBe(403);
    expect(code(res)).toBe(PERMISSION_DENIED);
  });

  test('B cannot read A\'s consents', async () => {
    await rest('user_consents', { method: 'POST', token: a.token, prefer: 'return=minimal', body: { kind: 'health_data', version: 'v-private' } });
    const res = await rest('user_consents', { token: b.token, query: `user_id=eq.${a.id}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('rows are append-only: the owner cannot UPDATE or DELETE their own', async () => {
    const update = await rest('user_consents', { method: 'PATCH', token: a.token, query: 'version=eq.v-owner', body: { version: 'v-rewritten' } });
    expect(update.status).toBe(403);
    expect(code(update)).toBe(PERMISSION_DENIED);

    const del = await rest('user_consents', { method: 'DELETE', token: a.token, query: 'version=eq.v-owner' });
    expect(del.status).toBe(403);
    expect(code(del)).toBe(PERMISSION_DENIED);

    expect((await consentsOf(a)).some(r => r.version === 'v-owner')).toBe(true);
  });

  test('an unknown kind, an empty version and an oversized version are check violations', async () => {
    const kind = await rest('user_consents', { method: 'POST', token: a.token, body: { kind: 'marketing', version: 'v1' } });
    expect(kind.status).toBe(400);
    expect(code(kind)).toBe(CHECK_VIOLATION);

    const empty = await rest('user_consents', { method: 'POST', token: a.token, body: { kind: 'terms', version: '' } });
    expect(code(empty)).toBe(CHECK_VIOLATION);

    const long = await rest('user_consents', { method: 'POST', token: a.token, body: { kind: 'terms', version: 'x'.repeat(61) } });
    expect(code(long)).toBe(CHECK_VIOLATION);
  });

  test('the same (user, kind, version) twice: unique violation on a plain insert, a no-op on ignore-duplicates', async () => {
    const body = { kind: 'withdrawal_waiver', version: 'v-twice' };
    expect((await rest('user_consents', { method: 'POST', token: a.token, prefer: 'return=minimal', body })).status).toBe(201);

    const plain = await rest('user_consents', { method: 'POST', token: a.token, body });
    expect(plain.status).toBe(409);
    expect(code(plain)).toBe(UNIQUE_VIOLATION);

    const upsert = await rest('user_consents', {
      method: 'POST',
      token: a.token,
      query: 'on_conflict=user_id,kind,version',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body,
    });
    expect(upsert.status).toBe(201);
    expect((await consentsOf(a)).filter(r => r.version === 'v-twice')).toHaveLength(1);
  });

  test('the request without a session cannot read or write', async () => {
    const read = await rest('user_consents', { query: 'select=id' });
    expect([401, 403]).toContain(read.status);

    const write = await rest('user_consents', { method: 'POST', body: { kind: 'terms', version: 'v-anon-key' } });
    expect([401, 403]).toContain(write.status);
  });

  test('a guest (anonymous session) records and reads their own consent', async () => {
    const guest = await createGuest();
    guestIds.push(guest.id);

    const res = await rest('user_consents', { method: 'POST', token: guest.token, prefer: 'return=minimal', body: { kind: 'age_14', version: 'v-guest' } });
    expect(res.status).toBe(201);

    const rows = await consentsOf(guest);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(guest.id);
  });

  test('deleting the auth user removes their consents', async () => {
    const victim = await ctx.createUser();
    await rest('user_consents', { method: 'POST', token: victim.token, prefer: 'return=minimal', body: { kind: 'terms', version: 'v-cascade' } });

    await deleteAuthUser(victim.id);

    const left = await rest('user_consents', { serviceRole: true, query: `user_id=eq.${victim.id}` });
    expect(left.body).toEqual([]);
  });
});
