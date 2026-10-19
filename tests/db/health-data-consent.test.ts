/**
 * FRESCO-917 (definitive audit C-13, GDPR art. 9) — allergies and diet are health data, and the
 * database refuses to store them for a user who has not recorded the `health_data` consent
 * (`user_consents`, ADR-0040). Proven with the user's OWN session, what a client can really do.
 *
 * Pinned:
 *   1. Without consent, writing `alergenos`, any `dieta_*` flag or `dieta_texto_libre` is refused,
 *      on UPDATE and on INSERT, and the stored row is untouched.
 *   2. With a `health_data` consent (any version) the same writes go through.
 *   3. A consent of another kind does not count, and neither does another user's consent.
 *   4. Without consent, everything that is not health data still works, and so does clearing it.
 *   5. A legacy profile that already holds health data and no consent can change other columns,
 *      but not touch the health ones.
 *   6. The service role (seed, admin tooling) is exempt.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { anonKey, createDbTestContext, nativeFetch, recordConsentRows, resolveUrl, rest, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CONSENT_MESSAGE = 'health_data consent required';

async function createGuest(): Promise<{ id: string, token: string }> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`[health-data-consent.test] anonymous sign-in failed: ${res.status} ${await res.text()}`);
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

describe.skipIf(!(RUN && reachable))('health data needs consent (real DB)', () => {
  const ctx = createDbTestContext();
  let a: DbTestUser;
  let b: DbTestUser;

  beforeAll(async () => {
    a = await ctx.createUser();
    b = await ctx.createUser();
  });

  const guestIds: string[] = [];

  afterAll(async () => {
    await Promise.all(guestIds.map(deleteAuthUser));
    await ctx.cleanupAll();
  });

  const update = async (user: DbTestUser, body: Record<string, unknown>) =>
    rest('user_profiles', { method: 'PATCH', token: user.token, prefer: 'return=minimal', query: `id=eq.${user.id}`, body });

  const profileOf = async (user: DbTestUser) =>
    ((await rest('user_profiles', { token: user.token, query: `id=eq.${user.id}&select=*` })).body as Array<Record<string, unknown>>)[0];

  const consent = async (user: { id: string }, kind: string, version = 'v-test') =>
    recordConsentRows(user.id, [kind], version);

  function expectRefused(result: { status: number, body: unknown }): void {
    expect(result.status).toBe(400);
    expect((result.body as { message?: string }).message ?? '').toContain(CONSENT_MESSAGE);
  }

  describe('without a health_data consent', () => {
    test.each([
      ['alergenos', { alergenos: ['gluten'] }],
      ['dieta_vegano', { dieta_vegano: true, dieta_vegetariano: true }],
      ['dieta_sin_gluten', { dieta_sin_gluten: true }],
      ['dieta_halal', { dieta_halal: true }],
      ['dieta_texto_libre', { dieta_texto_libre: 'celiaco' }],
    ])('UPDATE of %s is refused and the row is untouched', async (_name, body) => {
      expectRefused(await update(a, body));

      const row = await profileOf(a);
      expect(row.alergenos).toEqual([]);
      expect(row.dieta_vegano).toBe(false);
      expect(row.dieta_sin_gluten).toBe(false);
      expect(row.dieta_halal).toBe(false);
      expect(row.dieta_texto_libre ?? null).toBeNull();
    });

    test('INSERT of a new profile with allergens is refused', async () => {
      // A guest has no profile row yet, so its first write is the INSERT path.
      const guest = await createGuest();
      guestIds.push(guest.id);

      expectRefused(await rest('user_profiles', {
        method: 'POST',
        token: guest.token,
        prefer: 'return=minimal',
        body: { id: guest.id, alergenos: ['gluten'] },
      }));
      expect((await rest('user_profiles', { token: guest.token, query: `id=eq.${guest.id}&select=id` })).body).toEqual([]);

      // With the consent recorded, the same INSERT goes through.
      expect((await consent(guest, 'health_data')).status).toBeLessThan(300);
      expect((await rest('user_profiles', {
        method: 'POST',
        token: guest.token,
        prefer: 'return=minimal',
        body: { id: guest.id, alergenos: ['gluten'] },
      })).status).toBeLessThan(300);
    });

    test('an upsert that carries allergens is refused (the INSERT half fires first)', async () => {
      expectRefused(await rest('user_profiles', {
        method: 'POST',
        token: a.token,
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { id: a.id, alergenos: ['gluten'] },
      }));
    });

    test('non-health columns and empty health values are still accepted', async () => {
      expect((await update(a, { nombre: 'Ana' })).status).toBeLessThan(300);
      expect((await update(a, { alergenos: [], dieta_vegano: false, dieta_texto_libre: '   ' })).status).toBeLessThan(300);
      expect((await profileOf(a)).nombre).toBe('Ana');
    });

    test('a consent of another kind does not count', async () => {
      expect((await consent(a, 'terms')).status).toBeLessThan(300);
      expect((await consent(a, 'privacy')).status).toBeLessThan(300);

      expectRefused(await update(a, { alergenos: ['gluten'] }));
    });

    test('another user\'s health_data consent does not count', async () => {
      expect((await consent(b, 'health_data')).status).toBeLessThan(300);

      expectRefused(await update(a, { alergenos: ['gluten'] }));
    });
  });

  describe('with a health_data consent', () => {
    test('allergens and diet can be saved, and a later version of the text does not matter', async () => {
      expect((await consent(a, 'health_data', 'an-old-version')).status).toBeLessThan(300);

      expect((await update(a, {
        alergenos: ['gluten', 'lactosa'],
        dieta_vegetariano: true,
        dieta_sin_gluten: true,
        dieta_texto_libre: 'sin frutos secos',
      })).status).toBeLessThan(300);

      const row = await profileOf(a);
      expect(row.alergenos).toEqual(['gluten', 'lactosa']);
      expect(row.dieta_sin_gluten).toBe(true);
    });

    test('the owner of the consent is the one who benefits, not the other user', async () => {
      // b recorded health_data in the section above; a different user c has none.
      const c = await ctx.createUser();
      expectRefused(await update(c, { alergenos: ['gluten'] }));
      expect((await update(b, { alergenos: ['gluten'] })).status).toBeLessThan(300);
    });
  });

  describe('a legacy profile that holds health data and has no consent', () => {
    let legacy: DbTestUser;

    beforeAll(async () => {
      legacy = await ctx.createUser();
      // Seed the way the audit found them: health data in the row, no consent row (service role).
      const seeded = await rest('user_profiles', {
        method: 'PATCH',
        serviceRole: true,
        prefer: 'return=minimal',
        query: `id=eq.${legacy.id}`,
        body: { alergenos: ['gluten'], dieta_vegano: true, dieta_vegetariano: true },
      });
      expect(seeded.status).toBeLessThan(300);
    });

    test('can still change a column that is not health data', async () => {
      expect((await update(legacy, { nombre: 'Legacy' })).status).toBeLessThan(300);
    });

    test('cannot change the health columns until it consents', async () => {
      expectRefused(await update(legacy, { alergenos: ['gluten', 'huevo'] }));
      expect((await profileOf(legacy)).alergenos).toEqual(['gluten']);
    });

    test('can clear its health data without consenting', async () => {
      expect((await update(legacy, { alergenos: [], dieta_vegano: false, dieta_vegetariano: false })).status).toBeLessThan(300);
      expect((await profileOf(legacy)).alergenos).toEqual([]);
    });
  });

  test('the service role is exempt', async () => {
    const seeded = await ctx.createUser();

    const result = await rest('user_profiles', {
      method: 'PATCH',
      serviceRole: true,
      prefer: 'return=minimal',
      query: `id=eq.${seeded.id}`,
      body: { alergenos: ['gluten'] },
    });

    expect(result.status).toBeLessThan(300);
  });
});
