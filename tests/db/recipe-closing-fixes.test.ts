/**
 * FRESCO-880 (closing) — the FRESCO-876 corrections reach every database, not only the one the
 * data migration ran on (CI builds the database with migrations first and `seed.sql` after, so a
 * correction that lives only in a migration is overwritten by the seed), and "Merluza en salsa
 * verde" lists the parsley its description names.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const EXPECTED: [recipe: string, ingredient: string][] = [
  ['Panqueques integrales con miel', 'harina integral'],
  ['Croissant con jamón y queso', 'croissant'],
  ['Bacalao a la vizcaína', 'bacalao'],
  ['Merluza en salsa verde', 'perejil'],
];

describe.skipIf(!(RUN && reachable))('closing corrections of the catalogue review (real DB)', () => {
  test('each recipe lists the ingredient its own text names', async () => {
    const rows = await restAll<{ nombre: string, activo: boolean, ingredientes_principales: string[] | null }>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,ingredientes_principales',
      order: 'id',
    });

    const missing = EXPECTED.filter(([recipe, ingredient]) => {
      const named = rows.filter(r => r.activo && r.nombre === recipe);
      return named.length === 0 || named.some(r => !r.ingredientes_principales?.includes(ingredient));
    });

    expect(missing).toEqual([]);
  });
});
