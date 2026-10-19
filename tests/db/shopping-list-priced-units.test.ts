/**
 * FRESCO-1009 (audit 7b A7-LOGIC-01) — every (ingredient, unit) pair that `recipes.ingredientes_cantidades`
 * holds has a sane priced path in the shopping list.
 *
 * The audit's probe was a pure function over a hand-written list; what broke in production was the pairs
 * the CATALOG really carries. This reads the active catalog of the stack under test, runs each pair through
 * the real consolidation and pricing, and refuses a non-finite price or a line over the bound. The stack's
 * seed carries few quantities, so on a fresh local stack this checks little; on a stack loaded with the
 * real catalog (or a snapshot of it) it checks all of it. The committed snapshot
 * (`catalog-units.fixture.ts`) is covered by `unit-prices.test.ts` on every `bun test`.
 *
 * Runs only with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import { describe, expect, test } from 'bun:test';
import { classifyShoppingList } from '../../supabase/functions/generate-shopping-list/aisle-pricing.ts';
import { consolidateIngredientes } from '../../supabase/functions/generate-shopping-list/consolidator.ts';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const MAX_EUR_PER_LINE = 100;
const CANTIDAD: Record<string, number> = { g: 200, ml: 200, unidades: 2, cucharadas: 2, cucharaditas: 2, dientes: 3 };

interface Row { ingredientes_cantidades: Array<{ nombre?: string, unidad?: string }> | null }

describe.skipIf(!(RUN && reachable))('shopping-list prices over the stack\'s catalog (real DB)', () => {
  test('every (nombre, unidad) pair of the active recipes prices to a finite, bounded amount', async () => {
    const res = await rest('recipes', { serviceRole: true, query: 'activo=eq.true&ingredientes_cantidades=not.is.null&select=ingredientes_cantidades&limit=1000' });
    const pairs = new Map<string, { nombre: string, unidad: string }>();
    for (const row of res.body as Row[]) {
      for (const item of row.ingredientes_cantidades ?? []) {
        if (item.nombre && item.unidad) { pairs.set(`${item.nombre}|${item.unidad}`, { nombre: item.nombre, unidad: item.unidad }); }
      }
    }

    const bad: string[] = [];
    for (const { nombre, unidad } of pairs.values()) {
      const lines = consolidateIngredientes([{ nombre, cantidad: CANTIDAD[unidad] ?? 1, unidad, receta_id: 'r', raciones_receta: 4, raciones_usuario: 4, receta_nombre: 'R', dia: 'lunes' }]);
      const total = classifyShoppingList(lines).pasillos.flatMap(p => p.items).reduce((sum, item) => sum + (item.precio_estimado ?? 0), 0);
      if (!Number.isFinite(total) || total < 0 || total >= MAX_EUR_PER_LINE) { bad.push(`${nombre} (${unidad}) = ${total}`); }
    }

    expect(bad).toEqual([]);
  });
});
