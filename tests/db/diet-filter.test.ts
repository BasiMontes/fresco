/**
 * FRESCO-1016 (audit 7b A7-TEST-05) — the seven diet flags of the profile, against `get_filtered_recipes`.
 * The function has one predicate per flag; a regression in any of them (say `vegano` read as
 * `not vegetariano`) would serve meat to a vegan household and nothing used to fail. One test per flag:
 *   - every recipe it returns carries that diet tag as true, and it returns EXACTLY the active recipes that do;
 *   - an active recipe whose tag is false, missing, or whose whole `dieta` is null is never returned;
 *   - the flags add up (two flags = the recipes that satisfy both).
 * Kosher has a tag on recipes but no profile flag and no predicate, so it is not filterable: noted, not tested.
 *
 * Runs only with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, restAll, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/**
 * A diet flag of the profile -> the profile columns that person sets and the keys of `recipes.dieta` they
 * require. `check_vegano_es_vegetariano` makes a vegan profile a vegetarian one too, so "vegano" is both.
 */
const DIET_FLAGS = [
  ['dieta_vegetariano', ['dieta_vegetariano'], ['vegetariano']],
  ['dieta_vegano', ['dieta_vegano', 'dieta_vegetariano'], ['vegano', 'vegetariano']],
  ['dieta_sin_gluten', ['dieta_sin_gluten'], ['sin_gluten']],
  ['dieta_sin_lactosa', ['dieta_sin_lactosa'], ['sin_lactosa']],
  ['dieta_sin_huevo', ['dieta_sin_huevo'], ['sin_huevo']],
  ['dieta_keto', ['dieta_keto'], ['keto']],
  ['dieta_halal', ['dieta_halal'], ['halal']],
] as const;

interface CatalogRecipe { id: string, activo: boolean, dieta: Record<string, boolean | null> | null }

describe.skipIf(!(RUN && reachable))('profile diet flags vs get_filtered_recipes (real DB)', () => {
  const ctx = createDbTestContext();
  let catalog: CatalogRecipe[] = [];
  let probeId = '';

  beforeAll(async () => {
    // Every recipe, read in pages: PostgREST caps one response at 1000 rows.
    catalog = await restAll<CatalogRecipe>('recipes', { serviceRole: true, select: 'id,activo,dieta', order: 'id.asc' });
    // An ACTIVE recipe with no `dieta` at all must be excluded by every flag. The seed has some; if a
    // catalog ever stops having one, insert it (and switch it off afterwards: nothing deletes recipes).
    if (!catalog.some(recipe => recipe.activo && recipe.dieta === null)) {
      const created = await rest('recipes', {
        method: 'POST',
        serviceRole: true,
        prefer: 'return=representation',
        body: { nombre: 'Prueba sin dieta', slug: `prueba-sin-dieta-${crypto.randomUUID()}`, activo: true, dieta: null },
      });
      expect(created.status).toBeLessThan(300);
      probeId = (created.body as { id: string }[])[0].id;
      catalog.push({ id: probeId, activo: true, dieta: null });
    }
  });

  afterAll(async () => {
    if (probeId) {
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${probeId}`, prefer: 'return=minimal', body: { activo: false } });
    }
    await ctx.cleanupAll();
  });

  async function filteredFor(flags: string[]): Promise<Set<string>> {
    const user: DbTestUser = await ctx.createUser({ healthDataConsent: true });
    const patch = await rest('user_profiles', {
      method: 'PATCH',
      token: user.token,
      query: `id=eq.${user.id}`,
      prefer: 'return=minimal',
      body: Object.fromEntries(flags.map(flag => [flag, true])),
    });
    expect(patch.status).toBeLessThan(300);
    const res = await rpc('get_filtered_recipes', { p_user_id: user.id }, { token: user.token });
    expect(res.status).toBe(200);
    return new Set((res.body as { id: string }[]).map(recipe => recipe.id));
  }

  const satisfies = (recipe: CatalogRecipe, keys: string[]) => recipe.activo && keys.every(key => recipe.dieta?.[key] === true);

  test('with no flag set, every active recipe is returned (the baseline the flags narrow)', async () => {
    const returned = await filteredFor([]);

    expect([...returned].sort()).toEqual(catalog.filter(r => r.activo).map(r => r.id).sort());
  });

  test.each(DIET_FLAGS)('%s returns exactly the active recipes with every tag it needs, and nothing else', async (_name, columns, keys) => {
    const returned = await filteredFor([...columns]);
    const expected = catalog.filter(recipe => satisfies(recipe, [...keys]));
    const wronglyIn = catalog.filter(recipe => returned.has(recipe.id) && !satisfies(recipe, [...keys]));
    const wronglyOut = expected.filter(recipe => !returned.has(recipe.id));

    expect(wronglyIn.map(r => r.id), `returned although not ${keys.join('+')}`).toEqual([]);
    expect(wronglyOut.map(r => r.id), `missing although ${keys.join('+')}`).toEqual([]);
    // The filter must be doing something: the catalog holds active recipes it has to leave out.
    expect(catalog.some(recipe => recipe.activo && !satisfies(recipe, [...keys]))).toBe(true);
    expect(returned.size).toBeGreaterThan(0);
  });

  test.each(DIET_FLAGS)('%s never returns a recipe whose diet tags are missing altogether', async (_name, columns) => {
    const returned = await filteredFor([...columns]);

    const noDiet = catalog.filter(recipe => recipe.activo && recipe.dieta === null);
    expect(noDiet.length).toBeGreaterThan(0);
    expect(noDiet.filter(recipe => returned.has(recipe.id)).map(r => r.id)).toEqual([]);
  });

  test('flags add up: vegan and gluten-free together return the recipes that are both', async () => {
    const returned = await filteredFor(['dieta_vegano', 'dieta_vegetariano', 'dieta_sin_gluten']);
    const expected = catalog.filter(recipe => satisfies(recipe, ['vegano', 'vegetariano', 'sin_gluten']));

    expect([...returned].sort()).toEqual(expected.map(r => r.id).sort());
  });

  test('a vegan profile is a vegetarian one too: the database refuses vegano alone (check_vegano_es_vegetariano)', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });

    const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: { dieta_vegano: true } });

    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message ?? '').toContain('check_vegano_es_vegetariano');
  });

  test('a recipe switched off is returned to nobody, whatever the flags', async () => {
    const inactive = catalog.filter(recipe => !recipe.activo);
    const returned = await filteredFor([]);

    expect(inactive.filter(recipe => returned.has(recipe.id))).toEqual([]);
  });
});
