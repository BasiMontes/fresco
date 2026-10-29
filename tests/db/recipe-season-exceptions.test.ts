/**
 * FRESCO-1059 — `recipe_season_exceptions`: the recipes whose season the category rule of `compute_recipe_season`
 * must not decide. The five rows are the ones the owner approved on 2026-10-28 after reading the list recipe by
 * recipe, so they are pinned here by slug. The table refuses a season that is not a valid one.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const APPROVED: Record<string, string[]> = {
  'salmorejo-cordobes-b115': ['verano'],
  'hamburguesa-de-lentejas-y-zanahoria-b48': ['todo_el_ano'],
  'sopa-miso-con-edamame': ['todo_el_ano'],
  'sopa-miso-con-tofu-b47': ['todo_el_ano'],
  'sopa-miso-tofu-algas': ['todo_el_ano'],
  // FRESCO-1063: the cold soups and the falafel that lost their seasonal ingredient when the table was pruned.
  'gazpacho-andaluz': ['verano'],
  'gazpacho-andaluz-con-pepino-b49': ['verano'],
  'crema-fria-aguacate-pepino': ['verano'],
  'crema-fria-de-con-lima-con-ajo-asado-24': ['verano'],
  'crema-fria-de-con-lima-con-cilantro-22': ['verano'],
  'crema-fria-de-con-lima-con-limon-21': ['verano'],
  'crema-fria-de-con-lima-con-semillas-de-lino-23': ['verano'],
  'falafel-con-salsa-de-yogur-b34': ['todo_el_ano'],
};

describe.skipIf(!(RUN && reachable))('recipe_season_exceptions (real DB)', () => {
  test('holds exactly the exceptions the owner approved, each with a reason', async () => {
    const { status, body } = await rest('recipe_season_exceptions', { serviceRole: true, query: 'select=slug,temporadas,motivo&order=slug' });
    const rows = body as { slug: string, temporadas: string[], motivo: string }[];

    expect(status).toBe(200);
    expect(Object.fromEntries(rows.map(row => [row.slug, row.temporadas]))).toEqual(APPROVED);
    expect(rows.every(row => row.motivo.trim().length > 0)).toBe(true);
  });

  test('every exception names a recipe that exists in the catalogue', async () => {
    const slugs = Object.keys(APPROVED).map(slug => `"${slug}"`).join(',');
    const { status, body } = await rest('recipes', { serviceRole: true, query: `select=slug&slug=in.(${slugs})` });

    expect(status).toBe(200);
    expect((body as { slug: string }[]).map(row => row.slug).sort()).toEqual(Object.keys(APPROVED).sort());
  });

  test.each([
    ['a value outside the vocabulary, ñ included', ['otoño']],
    ['an empty list', []],
    ['repeats', ['verano', 'verano']],
    ['the wrong calendar order', ['invierno', 'otono']],
    ['todo_el_ano mixed with a season', ['todo_el_ano', 'verano']],
  ])('refuses %s', async (_name, temporadas) => {
    const { status } = await rest('recipe_season_exceptions', {
      method: 'POST',
      serviceRole: true,
      body: { slug: 'db-test-bad-season', temporadas, motivo: 'db test' },
    });

    expect(status).toBeGreaterThanOrEqual(400);
    const left = await rest('recipe_season_exceptions', { serviceRole: true, query: 'select=slug&slug=eq.db-test-bad-season' });
    expect(left.body).toEqual([]);
  });
});
