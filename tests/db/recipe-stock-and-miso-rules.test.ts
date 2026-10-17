/**
 * FRESCO-996 (audit 7b: A7-SAFEA-34, -35, -42, A7-SAFEB-02, -10, -12) — stock and miso, as RULES
 * over the whole catalogue (not a list of ids), so a recipe added later is held to the same rule:
 *
 *   1. every recipe whose ingredients or steps say "caldo" carries `apio` (owner decision,
 *      2026-10-17: over-tag by rule). Inactive rows too, so a reactivated recipe is already right.
 *      "su caldo" (a legume's own cooking liquid) is not a stock.
 *   2. every recipe with miso carries `gluten` and `soja` and is not `sin_gluten`, unless the text
 *      says "miso sin gluten". The four miso recipes used to disagree.
 *   3. a vegetarian or vegan recipe that uses a stock names it "caldo de verduras" in its
 *      ingredients, so the flag does not rest on a stock nobody named.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Row {
  slug: string
  activo: boolean
  alergenos: string[]
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[]
  pasos_resumen: string[]
}

const text = (row: Row) => [...(row.ingredientes_principales ?? []), ...(row.pasos_resumen ?? [])].join(' \n ').toLowerCase();
const hasStock = (row: Row) => /\bcaldo\b/.test(text(row).replace(/\bsu caldo\b/g, ' '));
const hasMiso = (row: Row) => /\bmiso\b/.test(text(row).replace(/\bmiso sin gluten\b/g, ' '));
const namesVegetableStock = (row: Row) => (row.ingredientes_principales ?? []).some(item => /\bcaldo de (?:verduras?|vegetal(?:es)?|hortalizas)\b/.test(item.toLowerCase()));

describe.skipIf(!(RUN && reachable))('stock and miso rules over the catalogue (real DB)', () => {
  async function catalogue() {
    const rows = await restAll<Row>('recipes', {
      serviceRole: true,
      select: 'slug,activo,alergenos,dieta,ingredientes_principales,pasos_resumen',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows;
  }

  test('every recipe with a stock carries apio, active or not', async () => {
    const missing = (await catalogue()).filter(row => hasStock(row) && !row.alergenos.includes('apio')).map(row => row.slug);

    expect(missing).toEqual([]);
  });

  test('every miso recipe carries gluten and soja and is not sin_gluten (the four used to disagree)', async () => {
    const rows = (await catalogue()).filter(hasMiso);
    expect(rows.map(row => row.slug)).toEqual(expect.arrayContaining([
      'sopa-miso-con-edamame',
      'sopa-miso-tofu-algas',
      'sopa-miso-con-tofu-b47',
      'crema-de-setas-con-miso-b57',
    ]));

    const inconsistent = rows
      .filter(row => !row.alergenos.includes('gluten') || !row.alergenos.includes('soja') || row.dieta?.sin_gluten !== false)
      .map(row => row.slug);

    expect(inconsistent).toEqual([]);
  });

  test('a vegetarian or vegan recipe that uses a stock names the vegetable stock', async () => {
    const unnamed = (await catalogue())
      .filter(row => (row.dieta?.vegetariano === true || row.dieta?.vegano === true) && hasStock(row) && !namesVegetableStock(row))
      .map(row => row.slug);

    expect(unnamed).toEqual([]);
  });
});
