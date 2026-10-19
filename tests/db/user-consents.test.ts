/**
 * FRESCO-794 (audit-6 A6-P1, ADR-0040) and FRESCO-1007 (audit 7b A7-API-02, A7-ABUSE-03) — the consent
 * registry `user_consents`, proven against the real database.
 *
 * The table is the evidence that a user consented (GDPR art. 7.1), so what must hold is who can write
 * it and what they can write. Until FRESCO-1007 a client could insert `(kind, version)` itself: the
 * route stamped the version from a server constant, but a client that skipped the route could claim any
 * version, and as many rows as it liked. Now:
 *   1. No client role can INSERT, with or without `user_id`, on behalf of itself or another user.
 *   2. `record_consents` is the only writer: no client role can EXECUTE it, the service role can, and
 *      the database sets `user_id` (from the argument) and `accepted_at`.
 *   3. It validates the kinds and the version, ignores a repeat of `(user, kind, version)` and refuses
 *      a user past 100 rows.
 *   4. Rows are append-only: no UPDATE, no DELETE, no reading someone else's.
 *   5. A guest (anonymous session) can read their own rows once the server wrote them.
 *   6. Deleting the auth user removes the rows.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { anonKey, createDbTestContext, nativeFetch, recordConsentRows, resolveUrl, rest, rpc, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const INVALID_PARAMETER = '22023';
const RAISED_EXCEPTION = 'P0001';

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

  describe('no client role can write the table (FRESCO-1007)', () => {
    test('an authenticated user cannot INSERT, not even their own row, with a version they invented', async () => {
      const own = await rest('user_consents', { method: 'POST', token: a.token, body: { kind: 'terms', version: 'v-forged-by-client' } });
      expect(own.status).toBe(403);
      expect(code(own)).toBe(PERMISSION_DENIED);

      const withId = await rest('user_consents', { method: 'POST', token: a.token, body: { user_id: a.id, kind: 'privacy', version: 'v-with-id' } });
      expect(code(withId)).toBe(PERMISSION_DENIED);

      expect((await consentsOf(a)).some(r => r.version.startsWith('v-forged') || r.version === 'v-with-id')).toBe(false);
    });

    test('nor for another user', async () => {
      const forged = await rest('user_consents', { method: 'POST', token: b.token, body: { user_id: a.id, kind: 'privacy', version: 'v-on-behalf' } });
      expect(forged.status).toBe(403);
      expect(code(forged)).toBe(PERMISSION_DENIED);
    });

    test('nor the upsert the route used to send', async () => {
      const upsert = await rest('user_consents', {
        method: 'POST',
        token: a.token,
        query: 'on_conflict=user_id,kind,version',
        prefer: 'resolution=ignore-duplicates,return=minimal',
        body: { kind: 'terms', version: 'v-old-upsert' },
      });
      expect(code(upsert)).toBe(PERMISSION_DENIED);
    });

    test('the request without a session cannot read or write', async () => {
      const read = await rest('user_consents', { query: 'select=id' });
      expect([401, 403]).toContain(read.status);

      const write = await rest('user_consents', { method: 'POST', body: { kind: 'terms', version: 'v-anon-key' } });
      expect([401, 403]).toContain(write.status);
    });

    test('not even the service role writes the table directly: only the function does', async () => {
      const direct = await rest('user_consents', { method: 'POST', serviceRole: true, body: { user_id: a.id, kind: 'terms', version: 'v-direct' } });
      expect(direct.status).toBe(403);
      expect(code(direct)).toBe(PERMISSION_DENIED);
    });
  });

  describe('record_consents', () => {
    test('is not executable by a client role', async () => {
      const args = { p_user_id: a.id, p_kinds: ['terms'], p_version: 'v-rpc-client' };

      const asUser = await rpc('record_consents', args, { token: a.token });
      expect(asUser.status).toBe(403);
      expect(code(asUser)).toBe(PERMISSION_DENIED);

      const asAnon = await rpc('record_consents', args);
      expect([401, 403]).toContain(asAnon.status);
      expect((await consentsOf(a)).some(r => r.version === 'v-rpc-client')).toBe(false);
    });

    test('the server records a consent; the database sets accepted_at, and the owner reads it', async () => {
      const res = await recordConsentRows(a.id, ['terms'], 'v-server');
      expect(res.status).toBeLessThan(300);

      const row = (await consentsOf(a)).find(r => r.version === 'v-server');
      expect(row?.user_id).toBe(a.id);
      expect(row?.kind).toBe('terms');
      expect(Date.now() - new Date(row!.accepted_at).getTime()).toBeLessThan(60_000);
    });

    test('records several kinds at once, and a repeat of (user, kind, version) is a no-op', async () => {
      await recordConsentRows(a.id, ['age_14', 'terms', 'privacy'], 'v-many');
      await recordConsentRows(a.id, ['age_14', 'privacy'], 'v-many');

      const rows = (await consentsOf(a)).filter(r => r.version === 'v-many');
      expect(rows.map(r => r.kind).sort()).toEqual(['age_14', 'privacy', 'terms']);
    });

    test('the same kind at a new version is a new row: that is how a text change is recorded', async () => {
      await recordConsentRows(a.id, ['terms'], 'v-new-text');

      expect((await consentsOf(a)).filter(r => r.kind === 'terms').map(r => r.version)).toEqual(expect.arrayContaining(['v-server', 'v-many', 'v-new-text']));
    });

    test.each([
      ['an unknown kind', ['marketing'], 'v1'],
      ['an empty list', [], 'v1'],
      ['more than five kinds', ['age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver', 'terms'], 'v1'],
      ['an empty version', ['terms'], ''],
      ['an oversized version', ['terms'], 'x'.repeat(61)],
    ])('refuses %s with 22023', async (_label, kinds, version) => {
      const res = await recordConsentRows(a.id, kinds, version);

      expect(res.status).toBe(400);
      expect(code(res)).toBe(INVALID_PARAMETER);
    });

    test('refuses a user who already holds 100 rows, and leaves the rows alone', async () => {
      const capped = await ctx.createUser();
      for (let i = 0; i < 20; i++) {
        // Five kinds per version: 20 versions are exactly 100 rows.
        expect((await recordConsentRows(capped.id, ['age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver'], `v-cap-${i}`)).status).toBeLessThan(300);
      }
      expect(await consentsOf(capped)).toHaveLength(100);

      const over = await recordConsentRows(capped.id, ['terms'], 'v-cap-over');
      expect(over.status).toBe(400);
      expect(code(over)).toBe(RAISED_EXCEPTION);
      expect((over.body as { message?: string }).message ?? '').toContain('limit of 100');
      expect(await consentsOf(capped)).toHaveLength(100);

      // A repeat adds nothing, so it is not over the cap.
      expect((await recordConsentRows(capped.id, ['terms'], 'v-cap-0')).status).toBeLessThan(300);
    });
  });

  test('B cannot read A\'s consents', async () => {
    await recordConsentRows(a.id, ['health_data'], 'v-private');
    const res = await rest('user_consents', { token: b.token, query: `user_id=eq.${a.id}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('rows are append-only: the owner cannot UPDATE or DELETE their own', async () => {
    const update = await rest('user_consents', { method: 'PATCH', token: a.token, query: 'version=eq.v-server', body: { version: 'v-rewritten' } });
    expect(update.status).toBe(403);
    expect(code(update)).toBe(PERMISSION_DENIED);

    const del = await rest('user_consents', { method: 'DELETE', token: a.token, query: 'version=eq.v-server' });
    expect(del.status).toBe(403);
    expect(code(del)).toBe(PERMISSION_DENIED);

    expect((await consentsOf(a)).some(r => r.version === 'v-server')).toBe(true);
  });

  test('a guest (anonymous session) reads their own consent once the server recorded it', async () => {
    const guest = await createGuest();
    guestIds.push(guest.id);

    expect((await recordConsentRows(guest.id, ['age_14'], 'v-guest')).status).toBeLessThan(300);

    const rows = await consentsOf(guest);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(guest.id);
  });

  test('deleting the auth user removes their consents', async () => {
    const victim = await ctx.createUser();
    await recordConsentRows(victim.id, ['terms'], 'v-cascade');

    await deleteAuthUser(victim.id);

    const left = await rest('user_consents', { serviceRole: true, query: `user_id=eq.${victim.id}` });
    expect(left.body).toEqual([]);
  });
});
