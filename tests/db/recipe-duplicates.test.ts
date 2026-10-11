/**
 * FRESCO-898 — the active catalog holds no duplicate recipes and no misleading names.
 *
 * 30 groups (62 recipes) shared exactly the same ingredient list and the same steps, and 23 of
 * them were named "... con verduras salteadas" without having those vegetables. The migration
 * folds each group into one recipe; this keeps a re-seed or a new import from bringing them back.
 * Inactive recipes are ignored: the seed still carries old rows that production deactivated.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` and the local stack answers — `bun run test:db`.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface RecipeRow {
  nombre: string
  activo: boolean
  ingredientes_principales: unknown
  pasos_resumen: unknown
}

async function activeRecipes(): Promise<RecipeRow[]> {
  const rows = await restAll<RecipeRow>('recipes', { serviceRole: true, select: 'nombre,activo,ingredientes_principales,pasos_resumen', order: 'id' });
  return rows.filter(r => r.activo);
}

describe.skipIf(!(RUN && reachable))('recipe duplicates (real DB)', () => {
  test('no two active recipes share the same ingredients and the same steps', async () => {
    const groups = new Map<string, string[]>();
    for (const r of await activeRecipes()) {
      const key = JSON.stringify([r.ingredientes_principales, r.pasos_resumen]);
      groups.set(key, [...(groups.get(key) ?? []), r.nombre]);
    }

    const duplicated = [...groups.values()].filter(names => names.length > 1);
    expect(duplicated).toEqual([]);
  });

  test('no active recipe is named "con verduras salteadas"', async () => {
    const names = (await activeRecipes()).map(r => r.nombre).filter(n => /verduras salteadas/i.test(n));

    expect(names).toEqual([]);
  });
});
