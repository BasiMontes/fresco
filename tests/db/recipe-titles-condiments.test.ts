/**
 * FRESCO-880 — a recipe title that ends in a condiment ("… con canela", "… con miel",
 * "… y frutos rojos") lists it as an ingredient, and the catalogue never offers two active
 * recipes with the same name and the same ingredients (the generator's variant labels
 * produced three "Huevos revueltos" that were one recipe).
 *
 * Checked by the database the suite runs against, over the whole catalogue.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CONDIMENT_AT_END = /(canela|miel|frutos rojos)$/i;

interface RecipeRow {
  nombre: string
  activo: boolean
  ingredientes_principales: string[] | null
}

describe.skipIf(!(RUN && reachable))('recipe titles vs condiments (real DB)', () => {
  async function activeRecipes() {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,ingredientes_principales',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows.filter(row => row.activo);
  }

  test('a title that ends in a condiment lists it as an ingredient', async () => {
    const unlisted = (await activeRecipes())
      .filter(row => CONDIMENT_AT_END.test(row.nombre))
      .filter((row) => {
        const condiment = row.nombre.match(CONDIMENT_AT_END)![1].toLowerCase();
        return !(row.ingredientes_principales ?? []).some(name => name.toLowerCase().includes(condiment));
      })
      .map(row => row.nombre);

    expect(unlisted).toEqual([]);
  });

  test('no two active recipes share the same name and the same ingredients', async () => {
    const seen = new Map<string, number>();
    for (const row of await activeRecipes()) {
      const key = `${row.nombre.trim().toLowerCase()}|${JSON.stringify(row.ingredientes_principales)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const repeated = [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key);

    expect(repeated).toEqual([]);
  });
});
