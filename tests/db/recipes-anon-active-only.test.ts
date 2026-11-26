/**
 * FRESCO-1315/QAFRESCO-31 — without a session only active recipes can be read.
 * A signed-in user (guests included, they are `authenticated`) keeps reading the
 * whole catalogue: menus already generated point at recipes retired since.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Row { id: string, activo: boolean }

describe.skipIf(!(RUN && reachable))('recipes read without a session (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let retiredId: string;

  beforeAll(async () => {
    user = await ctx.createUser();
    const retired = await rest('recipes', { serviceRole: true, query: 'select=id&activo=eq.false&order=id.asc&limit=1' });
    [{ id: retiredId }] = retired.body as Row[];
  });

  afterAll(async () => ctx.cleanupAll());

  test('an anonymous caller gets no retired recipe, not even by id', async () => {
    const listed = await rest('recipes', { query: 'select=id&activo=eq.false&limit=5' });
    const byId = await rest('recipes', { query: `select=id&id=eq.${retiredId}` });

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([]);
    expect(byId.body).toEqual([]);
  });

  test('an anonymous caller still reads the active catalogue', async () => {
    const res = await rest('recipes', { query: 'select=id,activo&limit=5' });

    expect(res.status).toBe(200);
    expect((res.body as Row[]).length).toBe(5);
    expect((res.body as Row[]).every(row => row.activo)).toBe(true);
  });

  test('a signed-in user still reads a retired recipe', async () => {
    const res = await rest('recipes', { token: user.token, query: `select=id,activo&id=eq.${retiredId}` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: retiredId, activo: false }]);
  });
});
