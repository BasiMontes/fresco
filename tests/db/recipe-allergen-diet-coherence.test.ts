/**
 * FRESCO-943 (audit 2026-10-12, C-02) — the allergen and diet tags of every ACTIVE recipe
 * agree with its own ingredient list. The allergen filter is a plain tag comparison, so a
 * recipe with "queso" and no `lactosa`, "jamón" and `halal`, or a wheat tortilla and
 * `sin_gluten` reaches the person who declared the allergy / the diet.
 *
 * Checked by the database the suite runs against, over the whole catalogue. The keyword
 * table, its explicit exceptions and the diet rules live in
 * `recipe-allergen-diet-rules.ts` (and are pinned without a stack by its unit test).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import type { RecipeTags } from './recipe-allergen-diet-rules';
import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';
import { auditRecipe } from './recipe-allergen-diet-rules';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow extends RecipeTags {
  activo: boolean
}

describe.skipIf(!(RUN && reachable))('recipe allergen and diet tags vs ingredients (real DB)', () => {
  async function activeRecipes() {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,alergenos,dieta,ingredientes_principales',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows.filter(row => row.activo);
  }

  test('every ingredient that is an allergen has its allergen tag', async () => {
    const missing = (await activeRecipes()).flatMap(auditRecipe).filter(message => message.includes(': falta '));

    expect(missing).toEqual([]);
  });

  test('the diet flags agree with the allergen tags and the ingredients', async () => {
    const contradictions = (await activeRecipes()).flatMap(auditRecipe).filter(message => !message.includes(': falta '));

    expect(contradictions).toEqual([]);
  });
});
