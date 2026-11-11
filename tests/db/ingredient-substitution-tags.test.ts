/**
 * FRESCO-1152 (revisión integral, hallazgo FS-4) — the allergen-safe substitution catalogue offered
 * "leche de avena" and "harina de avena sin gluten" to people with a gluten allergy or a gluten-free
 * diet. Oats are a cereal with gluten under Annex II of Regulation (EU) 1169/2011, and the recipe oracle
 * (`recipe-allergen-diet-rules.ts`) already lists `avena` in its gluten rule. The catalogue seed tagged
 * both rows as gluten free.
 *
 * Two halves, both against the real database:
 *   1. the catalogue is checked with the same keyword rule the recipes are: a substitute whose own name
 *      carries an allergen word must declare that allergen, and a row that declares gluten, lactose or
 *      egg must not also claim the matching diet flag. This is the net that fails the day a row that
 *      names an oat loses its tag;
 *   2. the function itself: a profile with gluten (declared allergen or gluten-free diet) is no longer
 *      offered an oat substitute, and still gets the safe ones.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers — `bun run test:db`.
 */

import type { DbTestUser } from './harness';
import { afterAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';
import { ALLERGEN_KEYWORDS, textHasAllergen } from './recipe-allergen-diet-rules';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface SubstitutionRow {
  ingrediente_original: string
  ingrediente_sustituto: string
  alergenos: string[]
  dieta: Record<string, boolean>
}

/**
 * Substitutes whose name carries a keyword of the oracle without being the allergen. One entry, one reason,
 * like `ALLERGEN_EXCEPTIONS` for the recipes; kept here because it is about this table, not about recipes.
 */
const NOT_THE_ALLERGEN: { sustituto: string, allergen: string, why: string }[] = [
  { sustituto: 'pasta de arroz', allergen: 'gluten', why: 'rice pasta' },
  { sustituto: 'yogur de coco', allergen: 'lactosa', why: 'coconut yogurt is plant-based' },
];

/** The diet flag that is the opposite of declaring each allergen. */
const DIET_FLAG_OF: Record<string, string> = { gluten: 'sin_gluten', lactosa: 'sin_lactosa', huevo: 'sin_huevo' };

async function allRows(): Promise<SubstitutionRow[]> {
  const res = await rest('ingredient_substitutions', {
    serviceRole: true,
    query: 'select=ingrediente_original,ingrediente_sustituto,alergenos,dieta&order=ingrediente_original.asc,ingrediente_sustituto.asc',
  });
  return res.body as SubstitutionRow[];
}

async function substitutesFor(user: DbTestUser, ingrediente: string): Promise<string[]> {
  const res = await rpc('get_safe_ingredient_substitutes', { p_ingrediente: ingrediente }, { token: user.token });
  expect(res.status).toBe(200);
  return (res.body as { ingrediente_sustituto: string }[]).map(r => r.ingrediente_sustituto);
}

async function patchProfile(user: DbTestUser, body: Record<string, unknown>): Promise<void> {
  const res = await rest('user_profiles', { method: 'PATCH', token: user.token, query: `id=eq.${user.id}`, prefer: 'return=minimal', body });
  expect(res.status).toBe(204);
}

describe.skipIf(!(RUN && reachable))('the substitution catalogue tags agree with the allergen rules (real DB)', () => {
  const ctx = createDbTestContext();

  afterAll(async () => ctx.cleanupAll());

  test('every substitute declares the allergens its own name requires', async () => {
    const findings: string[] = [];
    for (const row of await allRows()) {
      for (const allergen of Object.keys(ALLERGEN_KEYWORDS)) {
        const excused = NOT_THE_ALLERGEN.some(e => e.sustituto === row.ingrediente_sustituto && e.allergen === allergen);
        if (!excused && textHasAllergen(row.ingrediente_sustituto, allergen) && !row.alergenos.includes(allergen)) {
          findings.push(`${row.ingrediente_original} -> ${row.ingrediente_sustituto}: names ${allergen} but does not declare it`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  test('a row that declares gluten, lactose or egg does not claim the matching diet flag', async () => {
    const findings: string[] = [];
    for (const row of await allRows()) {
      for (const [allergen, flag] of Object.entries(DIET_FLAG_OF)) {
        if (row.alergenos.includes(allergen) && row.dieta[flag] === true) {
          findings.push(`${row.ingrediente_original} -> ${row.ingrediente_sustituto}: declares ${allergen} but claims ${flag}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  test('a gluten allergy is not offered an oat substitute, and still gets the safe ones', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    await patchProfile(user, { alergenos: ['gluten'] });

    const milk = await substitutesFor(user, 'leche');
    expect(milk).not.toContain('leche de avena');
    expect(milk).toContain('leche de coco');
    expect(await substitutesFor(user, 'harina de trigo')).not.toContain('harina de avena sin gluten');
  });

  test('a gluten-free diet is not offered an oat substitute either', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });
    await patchProfile(user, { dieta_sin_gluten: true });

    expect(await substitutesFor(user, 'leche')).not.toContain('leche de avena');
    expect(await substitutesFor(user, 'harina de trigo')).not.toContain('harina de avena sin gluten');
  });

  test('a profile with no gluten rule still gets the oat milk', async () => {
    const user = await ctx.createUser({ healthDataConsent: true });

    expect(await substitutesFor(user, 'leche')).toContain('leche de avena');
  });
});
