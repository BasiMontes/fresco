/**
 * FRESCO-1059 — the season of a recipe also reflects when the dish is wanted (ADR-0068). Two halves:
 *
 *   1. the catalogue: the recipes the owner approved on 2026-10-28 carry the season the rule gives them, pinned by
 *      slug (21 stews, soups and legume dishes to autumn and winter, the cold salmorejo to summer, the lentil burger
 *      and the three miso soups left all year, and six inactive variants of stewed lentils);
 *   2. the barrier: `recipes_temporada_coherence` now compares an ACTIVE recipe's season with `compute_recipe_season`
 *      (the ingredients first, then the category) and fires when the slug or the classification changes.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { rest, restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const COLD = ['otono', 'invierno'];

const TO_COLD = [
  'callos-a-la-madrilena-b107',
  'cocido-madrileno-b100',
  'estofado-de-ternera-con-vino-tinto-b112',
  'fabada-asturiana-b149',
  'guiso-de-ternera-con-patatas-b13',
  'patatas-a-la-riojana',
  'rabo-de-toro-estofado-b142',
  'alubias-blancas-con-chorizo-y-pimenton-b23',
  'fabada-asturiana',
  'frijoles-rancheros-carne',
  'judias-pintas-con-arroz-b128',
  'judiones-la-granja',
  'lentejas-estofadas-al-estilo-mediterraneo-con-guarnicion-de-temporada',
  'lentejas-estofadas-con-zanahoria-y-comino-b9',
  'crema-de-zanahoria-con-jengibre-b36',
  'ramen-de-pollo-b155',
  'sopa-de-ajo-con-huevo-b104',
  'sopa-de-cebolla-gratinada-b125',
  'sopa-de-fideos-con-pollo-b80',
  'sopa-fideos-pollo',
  'sopa-minestrone-b140',
];

const STAY_ALL_YEAR = [
  'hamburguesa-de-lentejas-y-zanahoria-b48',
  'sopa-miso-con-edamame',
  'sopa-miso-con-tofu-b47',
  'sopa-miso-tofu-algas',
];

const INACTIVE_TO_COLD = [
  'lentejas-estofadas-al-estilo-del-sur-con-guarnicion-de-temporada',
  'lentejas-estofadas-con-especias-con-guarnicion-de-temporada',
  'lentejas-estofadas-con-guarnicion-de-temporada',
  'lentejas-estofadas-con-hierbas-frescas-con-guarnicion-de-temporada',
  'lentejas-estofadas-con-verduras-salteadas',
  'lentejas-estofadas-estilo-casero-con-guarnicion-de-temporada',
];

describe.skipIf(!(RUN && reachable))('dish season in the catalogue (real DB)', () => {
  async function seasons(slugs: string[]): Promise<Map<string, { temporada: unknown, activo: boolean }>> {
    const rows = await restAll<{ slug: string, temporada: unknown, activo: boolean }>('recipes', {
      serviceRole: true,
      select: 'slug,temporada,activo',
      order: 'slug',
    });
    const wanted = new Set(slugs);
    return new Map(rows.filter(row => wanted.has(row.slug)).map(row => [row.slug, row]));
  }

  test('the 21 approved stews, soups and legume dishes are wanted in autumn and winter', async () => {
    const found = await seasons(TO_COLD);

    expect([...found.keys()].sort()).toEqual([...TO_COLD].sort());
    expect([...found.values()].every(row => row.activo)).toBe(true);
    expect([...found.values()].map(row => row.temporada)).toEqual(TO_COLD.map(() => COLD));
  });

  test('the salmorejo is a cold soup, so it is summer', async () => {
    const found = await seasons(['salmorejo-cordobes-b115']);

    expect(found.get('salmorejo-cordobes-b115')?.temporada).toEqual(['verano']);
  });

  test('the lentil burger and the three miso soups stay all year', async () => {
    const found = await seasons(STAY_ALL_YEAR);

    expect([...found.keys()].sort()).toEqual([...STAY_ALL_YEAR].sort());
    expect([...found.values()].map(row => row.temporada)).toEqual(STAY_ALL_YEAR.map(() => ['todo_el_ano']));
  });

  test('the six inactive variants of stewed lentils follow the same rule', async () => {
    const found = await seasons(INACTIVE_TO_COLD);

    expect([...found.keys()].sort()).toEqual([...INACTIVE_TO_COLD].sort());
    expect([...found.values()].every(row => !row.activo)).toBe(true);
    expect([...found.values()].map(row => row.temporada)).toEqual(INACTIVE_TO_COLD.map(() => COLD));
  });

  test('a season that comes from the ingredients was not touched (gazpacho and the cold creams stay summer)', async () => {
    const found = await seasons(['gazpacho-andaluz']);

    expect(found.get('gazpacho-andaluz')?.temporada).toEqual(['verano']);
  });

  test('categories the owner left out of the rule keep their season (rice, pasta, meat, fish)', async () => {
    const rows = await restAll<{ slug: string, activo: boolean, temporada: unknown, clasificacion: { categoria?: string } }>('recipes', {
      serviceRole: true,
      select: 'slug,activo,temporada,clasificacion',
      order: 'slug',
    });
    const left = rows.filter(row => row.activo && ['arroz', 'pasta', 'carne', 'pescado'].includes(row.clasificacion.categoria ?? ''));
    const allYear = left.filter(row => JSON.stringify(row.temporada) === '["todo_el_ano"]');

    expect(left.length).toBeGreaterThan(50);
    expect(allYear.length).toBeGreaterThan(20);
  });
});

describe.skipIf(!(RUN && reachable))('recipes_temporada_coherence with the dish rule (real DB)', () => {
  const created: string[] = [];

  async function insert(label: string, ingredientes: string[], clasificacion: Record<string, unknown>, temporada: unknown) {
    const name = `fresco-1059-${label}-${crypto.randomUUID()}`;
    const res = await rest('recipes', {
      method: 'POST',
      serviceRole: true,
      prefer: 'return=representation',
      body: { nombre: name, slug: name, ingredientes_principales: ingredientes, pasos_resumen: [], alergenos: ['apio'], dieta: {}, clasificacion, temporada, activo: true },
    });
    const id = (res.body as { id?: string }[] | null)?.[0]?.id;
    if (id) { created.push(id); }
    return { res, name, id };
  }

  const patch = async (id: string, changes: Record<string, unknown>) => rest('recipes', { method: 'PATCH', serviceRole: true, query: `id=eq.${id}`, body: changes });

  afterAll(async () => {
    // service_role has no DELETE on recipes: the throwaway rows are retired the way the catalogue does it.
    for (const id of created) { await patch(id, { activo: false }); }
  });

  test.each(['guiso', 'sopa'])('an active %s with no seasonal ingredient must be autumn and winter', async (categoria) => {
    const wrong = await insert(`${categoria}-wrong`, ['arroz', 'pollo'], { categoria }, ['todo_el_ano']);
    const error = wrong.res.body as { code?: string, message?: string };

    expect(wrong.res.status).toBe(400);
    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.message).toContain(wrong.name);
    expect(error.message).toContain('["otono", "invierno"]');
    expect((await insert(`${categoria}-right`, ['arroz', 'pollo'], { categoria }, COLD)).res.status).toBe(201);
  });

  test('legumbres follow the cold months unless the recipe is light', async () => {
    expect((await insert('legume-hearty', ['arroz', 'pollo'], { categoria: 'legumbres', es_ligero: false }, ['todo_el_ano'])).res.status).toBe(400);
    expect((await insert('legume-hearty-ok', ['arroz', 'pollo'], { categoria: 'legumbres', es_ligero: false }, COLD)).res.status).toBe(201);
    expect((await insert('legume-light', ['arroz', 'pollo'], { categoria: 'legumbres', es_ligero: true }, ['todo_el_ano'])).res.status).toBe(201);
  });

  test('the comfort and hearty flags do not decide, only the category does', async () => {
    const flags = { categoria: 'reposteria', es_comfort_food: true, es_contundente: true, es_ligero: false };

    expect((await insert('pastry-ok', ['arroz', 'pollo'], flags, ['todo_el_ano'])).res.status).toBe(201);
    expect((await insert('pastry-wrong', ['arroz', 'pollo'], flags, COLD)).res.status).toBe(400);
  });

  test('a season that comes from the ingredients beats the category', async () => {
    expect((await insert('stew-summer-ok', ['calabacín'], { categoria: 'guiso' }, ['primavera', 'verano'])).res.status).toBe(201);
    expect((await insert('stew-summer-wrong', ['calabacín'], { categoria: 'guiso' }, COLD)).res.status).toBe(400);
  });

  test('ingredients in conflict stay a person decision, whatever the category', async () => {
    expect((await insert('stew-conflict', ['apio', 'calabacín'], { categoria: 'guiso' }, ['verano'])).res.status).toBe(201);
  });

  test('changing the category of an active recipe re-checks its season', async () => {
    const { id } = await insert('reclassify', ['arroz', 'pollo'], { categoria: 'reposteria' }, ['todo_el_ano']);
    expect(id).toBeDefined();

    const toStew = await patch(id!, { clasificacion: { categoria: 'guiso' } });
    expect(toStew.status).toBe(400);
    expect((toStew.body as { code?: string }).code).toBe(CHECK_VIOLATION);

    const both = await patch(id!, { clasificacion: { categoria: 'guiso' }, temporada: COLD });
    expect(both.status).toBeLessThan(300);
  });

  test('changing the slug of an active recipe re-checks its season', async () => {
    const { id } = await insert('rename', ['arroz', 'pollo'], { categoria: 'reposteria' }, ['todo_el_ano']);
    expect(id).toBeDefined();

    const renamed = await patch(id!, { slug: `fresco-1059-renamed-${crypto.randomUUID()}` });
    expect(renamed.status).toBeLessThan(300);
  });
});
