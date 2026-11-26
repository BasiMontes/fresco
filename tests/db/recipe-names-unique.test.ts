/**
 * FRESCO-1317/QAFRESCO-3 — no two active recipes share a name, ignoring case and
 * outer spaces: two identical cards in the library cannot be told apart.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

describe.skipIf(!(RUN && reachable))('active recipe names (real DB)', () => {
  test('no name is used by more than one active recipe', async () => {
    const rows = await restAll<{ nombre: string, slug: string, activo: boolean }>('recipes', { serviceRole: true, select: 'nombre,slug,activo', order: 'id.asc' });
    const active = rows.filter(row => row.activo);
    const byName = new Map<string, string[]>();
    for (const row of active) {
      const key = row.nombre.trim().toLocaleLowerCase('es');
      byName.set(key, [...(byName.get(key) ?? []), row.slug]);
    }

    expect(active.length).toBeGreaterThan(500);
    expect([...byName].filter(([, slugs]) => slugs.length > 1)).toEqual([]);
  });
});
