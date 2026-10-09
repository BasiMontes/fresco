/**
 * FRESCO-880 — recipes whose description and steps both use an ingredient list it.
 * Pinned by name for the four recipes the review found; the catalogue-wide audit is
 * `scripts/queries/catalog-ingredient-review.sql`.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const EXPECTED: [recipe: string, ingredient: string][] = [
  ['Bowl de quinoa con aguacate', 'limón'],
  ['Ensalada waldorf con pollo', 'mayonesa'],
  ['Espaguetis a la carbonara', 'queso pecorino'],
  ['Poke bowl de atún y edamame', 'arroz'],
];

describe.skipIf(!(RUN && reachable))('recipe descriptions vs ingredient lists (real DB)', () => {
  test('each recipe lists the ingredient its description and steps use', async () => {
    const rows = await restAll<{ nombre: string, ingredientes_principales: string[] | null, ingredientes_cantidades: { nombre: string }[] | null }>('recipes', {
      serviceRole: true,
      select: 'nombre,ingredientes_principales,ingredientes_cantidades',
      order: 'id',
    });

    const missing = EXPECTED.filter(([recipe, ingredient]) => {
      const row = rows.find(r => r.nombre === recipe);
      return !row?.ingredientes_principales?.includes(ingredient);
    });

    expect(missing).toEqual([]);
  });
});
