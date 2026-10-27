/**
 * FRESCO-912 (audit 2026-10-12, C-08) — the allergen vocabulary covers all 14 allergens the EU
 * requires to be declared. `mostaza` and `altramuces` used to be rejected by
 * `recipes_alergenos_vocab`, so a recipe could not carry them and (because the app did not
 * offer them) a person could not declare them.
 *
 * Proves, against the real database: both tags are accepted on a recipe, an unknown tag is
 * still refused, and a person who declares either allergen no longer receives a recipe that
 * carries it through `get_filtered_recipes`, the only structural food-safety filter.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('allergen vocabulary: mostaza and altramuces (real DB)', () => {
  const ctx = createDbTestContext();
  const created: string[] = [];

  async function insertRecipe(alergenos: string[]) {
    const slug = `fresco-912-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: { nombre: slug, slug, alergenos, temporada: ['todo_el_ano'] },
    });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) {
      created.push(id);
    }
    return { res, id };
  }

  afterAll(async () => {
    for (const id of created) {
      // service_role has no DELETE on recipes: soft-delete the throwaway rows.
      await rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: { activo: false } });
    }
    await ctx.cleanupAll();
  });

  test.each(['mostaza', 'altramuces'])('a recipe can carry the %s tag', async (tag) => {
    const { res } = await insertRecipe([tag]);

    expect(res.status).toBe(201);
  });

  test('a tag outside the 14 is still refused', async () => {
    const { res } = await insertRecipe(['mostaza_de_dijon']);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('recipes_alergenos_vocab');
  });

  test.each(['mostaza', 'altramuces'])('declaring %s removes a recipe that carries it from get_filtered_recipes', async (allergen) => {
    const user = await ctx.createUser();
    const tagged = await insertRecipe([allergen]);
    const clean = await insertRecipe([]);
    const declare = await rest('user_profiles', {
      method: 'PATCH',
      serviceRole: true,
      query: `id=eq.${user.id}`,
      prefer: 'return=minimal',
      body: { alergenos: [allergen] },
    });
    expect(declare.status).toBeLessThan(300);

    const taggedRows = await rpc('get_filtered_recipes', { p_user_id: user.id, p_recipe_id: tagged.id }, { token: user.token });
    const cleanRows = await rpc('get_filtered_recipes', { p_user_id: user.id, p_recipe_id: clean.id }, { token: user.token });

    expect(taggedRows.body).toEqual([]);
    expect((cleanRows.body as unknown[]).length).toBe(1);
  });
});
