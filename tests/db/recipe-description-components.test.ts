/**
 * FRESCO-880 — recipes whose description names a component list it. Pinned by name for the
 * ten recipes the review found; the catalogue-wide audit is
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
  ['Arroz negro con calamares', 'tinta de calamar'],
  ['Curry de garbanzos y espinacas', 'leche de coco'],
  ['Ensalada de pasta fría', 'aceitunas'],
  ['Ensalada de pollo con curry', 'lechuga'],
  ['Ensalada griega', 'aceitunas'],
  ['Paella valenciana', 'conejo'],
  ['Tacos de pescado con repollo', 'tortilla de maíz'],
  ['Wrap de pollo con hummus', 'tortilla de trigo'],
];

describe.skipIf(!(RUN && reachable))('recipe descriptions name their components (real DB)', () => {
  test('each recipe lists the component its description names', async () => {
    const rows = await restAll<{ nombre: string, activo: boolean, ingredientes_principales: string[] | null, descripcion_corta: string | null }>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,ingredientes_principales,descripcion_corta',
      order: 'id',
    });

    const missing = EXPECTED.filter(([recipe, ingredient]) => {
      const row = rows.find(r => r.activo && r.nombre === recipe);
      return !row?.ingredientes_principales?.includes(ingredient);
    });
    const oil = rows.filter(r => r.activo && /aceite de oliva/i.test(r.descripcion_corta ?? '') && /^(?:crema de calabacín|ensalada de garbanzos con atún)$/i.test(r.nombre))
      .filter(r => !r.ingredientes_principales?.includes('aceite de oliva'))
      .map(r => r.nombre);

    expect(missing).toEqual([]);
    expect(oil).toEqual([]);
  });
});
