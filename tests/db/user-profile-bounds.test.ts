/**
 * FRESCO-914 (definitive audit C-10) — the size of a `user_profiles` row is bounded, proven against
 * the real database with the user's OWN session (what a client, a guest included, can actually do).
 *
 * Before, `alergenos`, `ingredientes_odiados`, `ingredientes_favoritos`, the free-text columns,
 * `nombre` and `planning_selection` had no limit, so one account could store megabytes, and
 * `get_filtered_recipes` unnests `ingredientes_odiados` once per recipe, so a huge array
 * multiplied the cost of every catalogue read.
 *
 * Pinned here, per field: exactly at the limit is accepted, one past it is refused with a check
 * violation that names the constraint, and a refused write leaves the stored value untouched.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';

describe.skipIf(!(RUN && reachable))('user_profiles size bounds (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  const update = async (body: Record<string, unknown>) =>
    rest('user_profiles', { method: 'PATCH', token: user.token, prefer: 'return=minimal', query: `id=eq.${user.id}`, body });

  const read = async (column: string) =>
    ((await rest('user_profiles', { token: user.token, query: `id=eq.${user.id}&select=${column}` })).body as Array<Record<string, unknown>>)[0][column];

  function expectRefused(result: { status: number, body: unknown }, constraint: string): void {
    expect(result.status).toBe(400);
    const body = result.body as { code?: string, message?: string };
    expect(body.code).toBe(CHECK_VIOLATION);
    expect(body.message ?? '').toContain(constraint);
  }

  const items = (n: number, size = 8) => Array.from({ length: n }, (_, i) => `i${String(i).padStart(size - 1, '0')}`.slice(0, size));

  describe.each([
    ['alergenos'],
    ['ingredientes_odiados'],
    ['ingredientes_favoritos'],
  ])('%s', (column) => {
    test('30 short elements are accepted', async () => {
      expect((await update({ [column]: items(30) })).status).toBeLessThan(300);
      expect(await read(column)).toHaveLength(30);
    });

    test('31 elements are refused and the stored list is untouched', async () => {
      const result = await update({ [column]: items(31) });

      expectRefused(result, 'user_profiles_lists_bounds');
      expect(await read(column)).toHaveLength(30);
    });

    test('a list whose joined text passes 2400 bytes is refused even with few elements', async () => {
      const result = await update({ [column]: ['x'.repeat(2401)] });

      expectRefused(result, 'user_profiles_lists_bounds');
    });

    test('30 elements of 60 characters, some of them two-byte, still fit under the byte cap', async () => {
      // The audit asked for "30 elements of 60 characters". Ten `ñ` (2 bytes) plus fifty ASCII is 70 bytes;
      // 30 of them joined by spaces is 2129 bytes, under the 2400 cap.
      const sixty = 'ñ'.repeat(10) + 'a'.repeat(50);

      expect((await update({ [column]: Array.from({ length: 30 }).fill(sixty) })).status).toBeLessThan(300);
    });
  });

  test('cocinas_favoritas: 30 elements are accepted and 31 are refused', async () => {
    const cuisine = 'española';

    expect((await update({ cocinas_favoritas: Array.from({ length: 30 }).fill(cuisine) })).status).toBeLessThan(300);
    expectRefused(await update({ cocinas_favoritas: Array.from({ length: 31 }).fill(cuisine) }), 'user_profiles_lists_bounds');
  });

  test('nombre: 80 characters are accepted and 81 are refused', async () => {
    expect((await update({ nombre: 'n'.repeat(80) })).status).toBeLessThan(300);
    expectRefused(await update({ nombre: 'n'.repeat(81) }), 'user_profiles_text_bounds');
    expect(await read('nombre')).toBe('n'.repeat(80));
  });

  test.each([
    ['dieta_texto_libre'],
    ['alergenos_texto_libre'],
    ['ingredientes_odiados_texto_libre'],
    ['cocinas_texto_libre'],
  ])('%s: 500 characters are accepted and 501 are refused', async (column) => {
    expect((await update({ [column]: 't'.repeat(500) })).status).toBeLessThan(300);
    expectRefused(await update({ [column]: 't'.repeat(501) }), 'user_profiles_text_bounds');
    expect(await read(column)).toBe('t'.repeat(500));
  });

  test('planning_selection: a small object is accepted, one past 4096 bytes is refused', async () => {
    const small = { lunes: ['desayuno', 'comida', 'cena'] };
    expect((await update({ planning_selection: small })).status).toBeLessThan(300);

    const huge = { lunes: ['x'.repeat(4096)] };
    expectRefused(await update({ planning_selection: huge }), 'user_profiles_planning_selection_bounds');
    expect(await read('planning_selection')).toEqual(small);
  });

  test('planning_selection must be a JSON object: an array or a string is refused', async () => {
    expectRefused(await update({ planning_selection: ['lunes'] }), 'user_profiles_planning_selection_bounds');
    expectRefused(await update({ planning_selection: 'lunes' }), 'user_profiles_planning_selection_bounds');
  });
});
