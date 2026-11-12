/**
 * FRESCO-1197 — `user_profiles.recorrido_visto` remembers, on the account, that the person has seen
 * (or skipped) the first-visit tour. Proven against the real database:
 *   1. A profile created now starts as not seen (false), so a new account gets the tour.
 *   2. The owner can mark it seen with their own session, like the other notice flags.
 *   3. Another user cannot change it (RLS: zero rows touched, value unchanged).
 *   4. A profile that holds allergens and has no health consent can still mark it: the consent
 *      trigger only checks an UPDATE that changes a health column (FRESCO-917), and this one does not.
 *
 * Accounts that existed before the migration are marked seen by the migration itself (the column is
 * added with `default true` and the default is then set to false). That cannot be seen from a test
 * that creates its users afterwards: it is checked against the rows of the database the migration is
 * applied to, see the migration header.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('user_profiles.recorrido_visto (real DB)', () => {
  const ctx = createDbTestContext();
  let owner: DbTestUser;
  let other: DbTestUser;

  beforeAll(async () => {
    owner = await ctx.createUser();
    other = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  const write = async (user: DbTestUser, target: DbTestUser, value: boolean) =>
    rest('user_profiles', { method: 'PATCH', token: user.token, prefer: 'return=representation', query: `id=eq.${target.id}`, body: { recorrido_visto: value } });

  const readAsService = async (user: DbTestUser) =>
    ((await rest('user_profiles', { serviceRole: true, query: `id=eq.${user.id}&select=recorrido_visto` })).body as Array<{ recorrido_visto: boolean }>)[0].recorrido_visto;

  test('a profile created now starts as not seen', async () => {
    expect(await readAsService(owner)).toBe(false);
  });

  test('the owner can mark the tour as seen with their own session', async () => {
    const result = await write(owner, owner, true);

    expect(result.status).toBeLessThan(300);
    expect(await readAsService(owner)).toBe(true);
  });

  test('another user cannot change someone else\'s mark', async () => {
    const fresh = await ctx.createUser();

    const result = await write(other, fresh, true);

    expect(result.body).toEqual([]);
    expect(await readAsService(fresh)).toBe(false);
  });

  test('a profile with allergens and no health consent can still mark the tour as seen', async () => {
    const withAllergens = await ctx.createUser();
    // The service role is exempt from the consent trigger, so it can seed the state a legacy
    // profile is in: health data in the row and no health_data consent behind it.
    const seeded = await rest('user_profiles', { method: 'PATCH', serviceRole: true, prefer: 'return=representation', query: `id=eq.${withAllergens.id}`, body: { alergenos: ['gluten'] } });
    expect(seeded.status).toBeLessThan(300);

    const result = await write(withAllergens, withAllergens, true);

    expect(result.status).toBeLessThan(300);
    expect(await readAsService(withAllergens)).toBe(true);
  });
});
