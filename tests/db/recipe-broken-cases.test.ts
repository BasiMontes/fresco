/**
 * FRESCO-880 — recipes that were broken beyond their ingredient list stay fixed: the
 * "obertura de arroz" typo, kale soups sold as "Sopa de ajo", and Caesar salads with no
 * lettuce.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow {
  nombre: string
  activo: boolean
  descripcion_corta: string | null
  ingredientes_principales: string[] | null
  pasos_resumen: string[] | null
}

describe.skipIf(!(RUN && reachable))('recipes broken beyond their list (real DB)', () => {
  async function activeRecipes() {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,descripcion_corta,ingredientes_principales,pasos_resumen',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows.filter(row => row.activo);
  }

  test('no recipe says "obertura de arroz"', async () => {
    const typo = (await activeRecipes())
      .filter(row => JSON.stringify(row).toLowerCase().includes('obertura de arroz'))
      .map(row => row.nombre);

    expect(typo).toEqual([]);
  });

  test('a "Sopa de ajo" is not a kale soup', async () => {
    const mislabelled = (await activeRecipes())
      .filter(row => /^sopa de ajo/i.test(row.nombre))
      .filter(row => (row.ingredientes_principales ?? []).includes('kale'))
      .map(row => row.nombre);

    expect(mislabelled).toEqual([]);
  });

  test('every active Caesar salad lists lettuce', async () => {
    const noLettuce = (await activeRecipes())
      .filter(row => /c[eé]sar/i.test(row.nombre))
      .filter(row => !(row.ingredientes_principales ?? []).some(name => name.toLowerCase().includes('lechuga')))
      .map(row => row.nombre);

    expect(noLettuce).toEqual([]);
  });
});
