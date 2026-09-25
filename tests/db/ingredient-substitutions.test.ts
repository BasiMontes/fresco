/**
 * FRESCO-715 — proves `get_safe_ingredient_substitutes` reads the CALLER's own
 * `user_profiles` row via `auth.uid()`, not a caller-supplied parameter (there
 * is none — see `ADR-0032`), and never returns a candidate that violates the
 * caller's declared allergens or disliked ingredients.
 *
 * Doctrine: `.agents/skills/sprint-development/references/rpc-authorization.md`
 * §5 — "which test proves both properties against the real database". This
 * function has no identity parameter to spoof (the strongest fix per §2), so
 * the equivalent proof is: two profiles with DIFFERENT declared restrictions
 * get DIFFERENTLY filtered results for the SAME ingredient, which is only
 * possible if the function is reading each caller's own `auth.uid()`-scoped
 * row rather than a fixed or wrong one.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` / `bun run test:coverage` skips the
 * whole file (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Substitute { ingrediente_sustituto: string, alergenos: string[] }

describe.skipIf(!(RUN && reachable))('get_safe_ingredient_substitutes (real DB)', () => {
  const ctx = createDbTestContext();
  let noAllergies: DbTestUser;
  let soyAllergic: DbTestUser;
  let dislikesTofu: DbTestUser;

  beforeAll(async () => {
    [noAllergies, soyAllergic, dislikesTofu] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    await Promise.all([
      rest('user_profiles', {
        method: 'PATCH',
        token: soyAllergic.token,
        query: `id=eq.${soyAllergic.id}`,
        prefer: 'return=minimal',
        body: { alergenos: ['soja'] },
      }),
      rest('user_profiles', {
        method: 'PATCH',
        token: dislikesTofu.token,
        query: `id=eq.${dislikesTofu.id}`,
        prefer: 'return=minimal',
        body: { ingredientes_odiados: ['tofu firme'] },
      }),
    ]);
  });

  afterAll(async () => ctx.cleanupAll());

  test('a household with no restrictions gets the seeded candidate', async () => {
    const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: 'gambas' }, { token: noAllergies.token });
    expect(res.status).toBe(200);
    const body = res.body as Substitute[];
    expect(body.map(r => r.ingrediente_sustituto)).toContain('tofu firme');
  });

  test('a soy-allergic household never sees a substitute that carries soja — same ingredient, own profile', async () => {
    const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: 'gambas' }, { token: soyAllergic.token });
    expect(res.status).toBe(200);
    const body = res.body as Substitute[];
    expect(body.map(r => r.ingrediente_sustituto)).not.toContain('tofu firme');
    expect(body).toEqual([]);
  });

  test('a household that dislikes the candidate ingredient never sees it, independent of allergens', async () => {
    const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: 'gambas' }, { token: dislikesTofu.token });
    expect(res.status).toBe(200);
    const body = res.body as Substitute[];
    expect(body.map(r => r.ingrediente_sustituto)).not.toContain('tofu firme');
  });

  test('an ingredient with no catalog entry returns an explicit empty array, never an error', async () => {
    const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: 'ingrediente-inexistente-xyz' }, { token: noAllergies.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('lookup is case-insensitive on the original ingredient name', async () => {
    const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: 'GAMBAS' }, { token: noAllergies.token });
    expect(res.status).toBe(200);
    const body = res.body as Substitute[];
    expect(body.map(r => r.ingrediente_sustituto)).toContain('tofu firme');
  });
});
