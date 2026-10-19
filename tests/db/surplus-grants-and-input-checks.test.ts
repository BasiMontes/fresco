/**
 * FRESCO-1015 (audit 7b: A7-AUTHZ-03, -04, -05, A7-API-03) — privileges and input checks that were
 * wider than anything the app uses:
 *
 *   1. `authenticated` cannot UPDATE `meal_plan_recipes.tipo_plato` nor `meal_plans.fecha_inicio`
 *      through PostgREST, while the column the client really writes (`coste_estimado`) still works;
 *   2. `anon` cannot EXECUTE `confirm_ingredient_substitution`;
 *   3. `user_profiles.alergenos` rejects a value outside the 14-slug vocabulary (`Soja`);
 *   4. `jsonb_add_item` rejects an item that is not a JSON object (22023);
 *   5. local Auth asks for a recent login or a nonce before a password change.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the DB half (see `tests/db/README.md`).
 */

import type { DbTestUser } from './harness';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogRecipeIds, createDbTestContext, rest, rpc, seedMealPlan, seedShoppingList, seedSlots, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const code = (body: unknown) => (body as { code?: string } | null)?.code;

describe('local Auth config (static)', () => {
  test('secure_password_change is on, so a password change needs a recent login or a nonce', () => {
    expect(readFileSync('supabase/config.toml', 'utf8')).toMatch(/^secure_password_change = true$/m);
  });
});

describe.skipIf(!(RUN && reachable))('surplus grants and input checks (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;
  let planId: string;
  let slotId: string;
  let listId: string;

  beforeAll(async () => {
    user = await ctx.createUser({ healthDataConsent: true });
    ({ id: planId } = await seedMealPlan(user));
    const [recipeId] = await catalogRecipeIds(user, 1);
    [slotId] = await seedSlots(user, planId, [{ recipeId, tipoPlato: 'comida' }]);
    listId = await seedShoppingList(user, planId);
  });

  afterAll(async () => ctx.cleanupAll());

  describe('column grants', () => {
    test('an authenticated user cannot change the tipo_plato of a slot', async () => {
      const res = await rest('meal_plan_recipes', { method: 'PATCH', token: user.token, query: `id=eq.${slotId}`, body: { tipo_plato: 'cena' } });

      expect(res.status).toBe(403);
      expect(code(res.body)).toBe('42501');
    });

    test('an authenticated user cannot change the fecha_inicio of a plan', async () => {
      const res = await rest('meal_plans', { method: 'PATCH', token: user.token, query: `id=eq.${planId}`, body: { fecha_inicio: '2099-02-02' } });

      expect(res.status).toBe(403);
      expect(code(res.body)).toBe('42501');
    });

    test('coste_estimado, the one plan column the client writes, still updates', async () => {
      const res = await rest('meal_plans', {
        method: 'PATCH',
        token: user.token,
        query: `id=eq.${planId}`,
        prefer: 'return=representation',
        body: { coste_estimado: 42 },
      });

      expect(res.status).toBe(200);
      expect((res.body as { coste_estimado: number }[])[0].coste_estimado).toBe(42);
    });
  });

  describe('confirm_ingredient_substitution', () => {
    test('anon has no entry point', async () => {
      const res = await rpc('confirm_ingredient_substitution', { p_slot_id: slotId, p_ingrediente_original: 'tomate', p_ingrediente_sustituto: 'pimiento' });

      expect([401, 403]).toContain(res.status);
      expect(code(res.body)).toBe('42501');
    });
  });

  describe('user_profiles.alergenos vocabulary', () => {
    test('a value outside the 14 slugs is rejected', async () => {
      const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, body: { alergenos: ['Soja'] } });

      expect(res.status).toBe(400);
      expect(code(res.body)).toBe('23514');
    });

    test('a value inside the vocabulary is accepted', async () => {
      const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body: { alergenos: ['soja', 'mostaza'] } });

      expect(res.status).toBe(204);
    });
  });

  describe('jsonb_add_item', () => {
    test.each([
      ['a string', 'Tomate'],
      ['an array', [{ nombre: 'Tomate' }]],
      ['a number', 7],
      ['null', null],
    ])('rejects %s with 22023', async (_label, item) => {
      const res = await rpc('jsonb_add_item', { p_list_id: listId, p_pasillo_nombre: 'Verduras', p_item: item }, { token: user.token });

      expect(res.status).toBe(400);
      expect(code(res.body)).toBe('22023');
    });

    test('still appends an object', async () => {
      const res = await rpc('jsonb_add_item', { p_list_id: listId, p_pasillo_nombre: 'Verduras', p_item: { nombre: 'Pimiento', comprado: false } }, { token: user.token });

      expect(res.status).toBe(204);
    });
  });
});
