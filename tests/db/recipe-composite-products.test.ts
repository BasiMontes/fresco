/**
 * FRESCO-997 (audit 7b: A7-SAFEA-06 to -48, A7-SAFEB-09 to -19) — compound products, as RULES over
 * the whole catalogue (not a list of ids), so a recipe added later is held to the same words:
 *
 *   1. curry, mayonnaise and barbecue sauce carry `mostaza`;
 *   2. vinegar, raisins, mayonnaise, barbecue sauce, beer and sushi rice carry `sulfitos` ("vinagre
 *      de arroz" is made without grape must and does not count);
 *   3. a `sin_gluten` recipe never names plain tamari or nachos: it says "tamari sin gluten" /
 *      "nachos sin gluten", so the ingredient tells the buyer which product to pick;
 *   4. a product the steps name is also in the ingredient list (bechamel, crema de limón, salsa de
 *      soja, vinagre, curry), so the shopping list buys it;
 *   5. FRESCO-1086 (audit 8 A8-SAFEA-01): a recipe that says César, in its name or its text, carries
 *      `huevo` and `pescado` (the dressing is egg yolk and anchovy) and never claims `sin_huevo`;
 *   6. FRESCO-1093 to 1096 and 1115 (audit 8 allergen batch): pad thai, falafel, an unspecified
 *      "bebida vegetal", a fish without scales and a Caesar dressing keep only the claims their text
 *      can back (the owner's criterion of 2026-11-04: over-label when a product is not specified).
 *
 * Inactive rows too, so a reactivated recipe is already right.
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
  nombre: string
  alergenos: string[]
  dieta: Record<string, boolean> | null
  ingredientes_principales: string[]
  pasos_resumen: string[]
}

const lower = (items: string[] | null) => (items ?? []).join(' \n ').toLowerCase();
const text = (row: Row) => `${lower(row.ingredientes_principales)} \n ${lower(row.pasos_resumen)}`;

const MUSTARD = /\b(?:mostaza|curry|mayonesa|barbacoa)\b/;
const SULFITES = /\b(?:vino|vinagre|pasas|orejones|vermut|cava|sidra|mayonesa|barbacoa|cerveza|arroz de sushi)\b/;
const BARE_TAMARI = /\btamari\b(?! sin gluten)/;
const BARE_NACHOS = /\bnachos(?: de ma[ií]z)?\b(?! sin gluten)/;
/** Product named in a step -> the regex that finds it, the way the oracle reads it. */
const STEP_PRODUCTS: [string, RegExp][] = [
  ['salsa de soja', /\bsalsa de soja\b/],
  ['bechamel', /\bbechamel\b/],
  ['crema de limón', /\bcrema de lim[oó]n\b/],
  ['vinagre', /\bvinagre\b/],
  ['curry', /\bcurry\b/],
];

describe.skipIf(!(RUN && reachable))('compound products over the catalogue (real DB)', () => {
  async function catalogue() {
    const rows = await restAll<Row>('recipes', {
      serviceRole: true,
      select: 'slug,nombre,alergenos,dieta,ingredientes_principales,pasos_resumen',
      order: 'id',
    });
    expect(rows.length).toBeGreaterThan(1000);
    return rows;
  }

  test('every recipe with curry, mayonnaise or barbecue sauce carries mostaza', async () => {
    const missing = (await catalogue()).filter(row => MUSTARD.test(text(row)) && !row.alergenos.includes('mostaza')).map(row => row.slug);

    expect(missing).toEqual([]);
  });

  test('every recipe with vinegar, raisins, mayonnaise, barbecue sauce, beer or sushi rice carries sulfitos', async () => {
    const missing = (await catalogue())
      .filter(row => SULFITES.test(text(row).replace(/\bvinagre de arroz\b/g, ' ')) && !row.alergenos.includes('sulfitos'))
      .map(row => row.slug);

    expect(missing).toEqual([]);
  });

  test('a sin_gluten recipe names tamari and nachos as the gluten-free product', async () => {
    const rows = (await catalogue()).filter(row => row.dieta?.sin_gluten === true);
    expect(rows.filter(row => /\btamari sin gluten\b/.test(text(row))).length).toBeGreaterThanOrEqual(31);

    const bare = rows.filter(row => BARE_TAMARI.test(text(row)) || BARE_NACHOS.test(text(row))).map(row => row.slug);

    expect(bare).toEqual([]);
  });

  test('a product the steps name is in the ingredient list (the query returns 0 for the keyword list)', async () => {
    const rows = await catalogue();
    const missing = STEP_PRODUCTS.flatMap(([product, pattern]) =>
      rows
        .filter(row => pattern.test(lower(row.pasos_resumen)) && !pattern.test(lower(row.ingredientes_principales)))
        .map(row => `${row.slug}: ${product}`));

    expect(missing).toEqual([]);
  });

  test('every recipe that says César, in its name or its text, carries huevo and pescado and is not sin_huevo (the query returns 0)', async () => {
    const caesar = (await catalogue()).filter(row => /c[eé]sar/i.test(`${row.nombre} \n ${text(row)}`));
    expect(caesar.length).toBeGreaterThanOrEqual(16);

    const wrong = caesar
      .filter(row => !row.alergenos.includes('huevo') || !row.alergenos.includes('pescado') || row.dieta?.sin_huevo === true)
      .map(row => row.slug);

    expect(wrong).toEqual([]);
  });

  test('pad thai tags huevo and pescado and is not sin_huevo; falafel tags gluten, huevo and sesamo and is neither sin_gluten nor sin_huevo (the query returns 0)', async () => {
    const rows = await catalogue();
    const padThai = rows.filter(row => /pad thai/i.test(row.nombre));
    const falafel = rows.filter(row => /falafel/i.test(row.nombre));
    expect(padThai.length).toBeGreaterThanOrEqual(2);
    expect(falafel.length).toBeGreaterThanOrEqual(1);

    const wrongPadThai = padThai
      .filter(row => !row.alergenos.includes('huevo') || !row.alergenos.includes('pescado') || row.dieta?.sin_huevo === true)
      .map(row => row.slug);
    const wrongFalafel = falafel
      .filter(row => !['gluten', 'huevo', 'sesamo'].every(a => row.alergenos.includes(a)) || row.dieta?.sin_gluten === true || row.dieta?.sin_huevo === true)
      .map(row => row.slug);

    expect(wrongPadThai).toEqual([]);
    expect(wrongFalafel).toEqual([]);
  });

  test('a recipe that uses an unspecified "bebida vegetal" tags soja and frutos_de_cascara (the query returns 0)', async () => {
    const plantDrink = (await catalogue()).filter(row => /bebida vegetal/i.test(text(row)));
    expect(plantDrink.length).toBeGreaterThanOrEqual(3);

    const wrong = plantDrink
      .filter(row => !row.alergenos.includes('soja') || !row.alergenos.includes('frutos_de_cascara'))
      .map(row => row.slug);

    expect(wrong).toEqual([]);
  });

  test('no kosher recipe names a fish without scales (the query returns 0)', async () => {
    const wrong = (await catalogue())
      .filter(row => row.dieta?.kosher === true && /\b(?:rape|anguilas?|siluro|tiburon|tiburón|cazon|cazón|pez espada|emperador|marrajo|mielga|lamprea)\b/i.test(text(row)))
      .map(row => row.slug);

    expect(wrong).toEqual([]);
  });

  test('a Caesar recipe claims sin_gluten only when its text says so (the query returns 0)', async () => {
    const wrong = (await catalogue())
      .filter(row => /c[eé]sar/i.test(row.nombre) && row.dieta?.sin_gluten === true && !/sin gluten/i.test(row.ingredientes_principales.join(' ')))
      .map(row => row.slug);

    expect(wrong).toEqual([]);
  });
});
