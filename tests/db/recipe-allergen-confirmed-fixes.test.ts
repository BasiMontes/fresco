/**
 * FRESCO-995 (audit 7b: A7-SAFEB-01, A7-SAFEB-08, A7-SAFEA-08, -09, -27, -32, -33) — seven active
 * recipes omitted an allergen that their own text confirms, so the allergen filter (a plain tag
 * comparison) served them to the people who declared it. This pins the corrected tags by slug.
 *
 * `recipe-allergen-diet-coherence.test.ts` already catches six of the seven through the oracle.
 * This file exists for the one the oracle cannot see: `pad-thai-de-gambas-b41` only says
 * "la salsa" in its steps, so only an exact assertion on its tags can hold it.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file (see `tests/db/README.md`).
 */

import { describe, expect, test } from 'bun:test';
import { rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Row {
  slug: string
  activo: boolean
  alergenos: string[]
  dieta: Record<string, boolean>
}

/** slug -> allergens the recipe must carry, and the free-of flags that must be false. */
const CONFIRMED: { slug: string, why: string, alergenos: string[], notFree: string[] }[] = [
  { slug: 'tostada-hummus-pepino', why: 'hummus is made with tahini', alergenos: ['gluten', 'sesamo'], notFree: [] },
  { slug: 'moussaka-de-berenjena', why: 'bechamel is thickened with flour', alergenos: ['gluten', 'lactosa'], notFree: ['sin_gluten'] },
  { slug: 'pad-thai-de-gambas', why: 'soy sauce is soy and wheat', alergenos: ['crustaceos', 'huevo', 'cacahuetes', 'soja', 'gluten'], notFree: ['sin_gluten'] },
  { slug: 'pad-thai-de-gambas-b41', why: 'the pad thai sauce is soy sauce (its steps say only "la salsa")', alergenos: ['crustaceos', 'cacahuetes', 'soja', 'gluten'], notFree: ['sin_gluten'] },
  { slug: 'crepes-de-espinacas-y-queso-b124', why: 'crepe batter is made with egg', alergenos: ['gluten', 'lactosa', 'huevo'], notFree: ['sin_huevo'] },
  { slug: 'tarta-de-limon-b145', why: 'the lemon cream is set with egg', alergenos: ['gluten', 'lactosa', 'huevo'], notFree: ['sin_huevo'] },
  { slug: 'croissant-jamon-queso', why: 'a croissant is glazed with egg', alergenos: ['gluten', 'lactosa', 'huevo'], notFree: ['sin_huevo'] },
];

describe.skipIf(!(RUN && reachable))('confirmed allergen omissions are corrected (real DB)', () => {
  test.each(CONFIRMED)('$slug carries its allergens and is not free-of what it contains ($why)', async ({ slug, alergenos, notFree }) => {
    const res = await rest('recipes', { serviceRole: true, query: `slug=eq.${slug}&select=slug,activo,alergenos,dieta` });
    const row = (res.body as Row[])[0];

    expect(row).toBeDefined();
    expect(row.activo).toBe(true);
    expect([...row.alergenos].sort()).toEqual([...alergenos].sort());
    for (const flag of notFree) { expect(row.dieta[flag]).toBe(false); }
  });
});
