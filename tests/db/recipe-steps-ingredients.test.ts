/**
 * FRESCO-880 — a recipe whose own steps use sésamo, perejil or comino lists it as an
 * ingredient, and a recipe that uses sésamo declares the `sesamo` allergen. Sesame is one
 * of the 14 EU allergens and the food-safety filter reads `alergenos`, so a steps text that
 * names it while the column says nothing is a safety gap, not a naming nit.
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

const SPICES = ['sésamo', 'perejil', 'comino'] as const;

interface RecipeRow {
  nombre: string
  activo: boolean
  ingredientes_principales: string[] | null
  alergenos: string[] | null
  pasos_resumen: string[] | null
}

describe.skipIf(!(RUN && reachable))('recipe steps vs ingredients and allergens (real DB)', () => {
  async function activeRecipes() {
    const rows = await restAll<RecipeRow>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,ingredientes_principales,alergenos,pasos_resumen',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows.filter(row => row.activo);
  }

  test('every spice the steps use is in the ingredient list', async () => {
    const missing = (await activeRecipes()).flatMap((row) => {
      const steps = (row.pasos_resumen ?? []).join(' ').toLowerCase();
      const names = (row.ingredientes_principales ?? []).map(name => name.toLowerCase());
      return SPICES
        .filter(spice => steps.includes(spice) && !names.some(name => name.includes(spice)))
        .map(spice => `${row.nombre}: ${spice}`);
    });

    expect(missing).toEqual([]);
  });

  test('every recipe whose steps use sésamo declares the sesamo allergen', async () => {
    const undeclared = (await activeRecipes())
      .filter(row => (row.pasos_resumen ?? []).join(' ').toLowerCase().includes('sésamo'))
      .filter(row => !(row.alergenos ?? []).includes('sesamo'))
      .map(row => row.nombre);

    expect(undeclared).toEqual([]);
  });
});
