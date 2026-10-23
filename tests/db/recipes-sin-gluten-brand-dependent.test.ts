/**
 * FRESCO-1050 (review of FRESCO-908): a recipe must not claim `sin_gluten` while it uses an ingredient
 * that, bought as a product, very often carries wheat: stock cubes, morcilla, callos and salsa verde.
 * Someone with coeliac disease who filters by the diet trusts that no recipe carries wheat.
 *
 * The data change lives in `20261023131403_recipes_sin_gluten_brand_dependent.sql` (by rule, for the
 * hosted database) and in `supabase/seed.sql` (the same 13 rows, for the seeded one). This test reads
 * the WHOLE catalogue, inactive rows included, and fails if any of them claims it again. It reads
 * `ingredientes_principales` because the seeded catalogue has no `ingredientes_cantidades`: a check on
 * that column would pass on an empty match.
 *
 * Runs only with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/** Exact ingredient names (lower case) the review judged the likeliest to carry wheat. */
const WHEAT_PRONE = ['caldo', 'caldo de carne', 'caldo de pollo', 'morcilla', 'callos', 'salsa verde'] as const;

interface CatalogRecipe {
  id: string
  nombre: string
  activo: boolean
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[] | null
}

describe.skipIf(!(RUN && reachable))('recipes: no sin_gluten claim on a wheat-prone ingredient (FRESCO-1050)', () => {
  test('no recipe, active or not, claims sin_gluten while it lists one of those ingredients', async () => {
    const catalog = await restAll<CatalogRecipe>('recipes', { serviceRole: true, select: 'id,nombre,activo,dieta,ingredientes_principales', order: 'id.asc' });

    const offenders = catalog
      .filter(r => r.dieta?.sin_gluten === true)
      .filter(r => (r.ingredientes_principales ?? []).some(name => WHEAT_PRONE.includes(String(name).toLowerCase() as (typeof WHEAT_PRONE)[number])))
      .map(r => `${r.nombre} (${r.id.slice(0, 8)})`);

    expect(offenders).toEqual([]);
  });

  test('the diet is still claimed by the rest of the catalogue: the rule is narrow, not a wipe', async () => {
    const catalog = await restAll<CatalogRecipe>('recipes', { serviceRole: true, select: 'id,activo,dieta', order: 'id.asc' });

    const claiming = catalog.filter(r => r.activo && r.dieta?.sin_gluten === true).length;

    // 405 active recipes claimed it before the change and 13 lost it; a generous floor still catches a wipe.
    expect(claiming).toBeGreaterThan(300);
  });
});
